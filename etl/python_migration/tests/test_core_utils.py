"""Regression tests for ETL helpers that do not need external services."""

import unittest
from decimal import Decimal

from core.utils import (
    build_legacy_mapping,
    execute_query_with_retry,
    safe_decimal,
    safe_int,
    safe_str,
)


class FakeCursor:
    def __init__(self, rows=(), failures=0):
        self.rows = list(rows)
        self.failures = failures
        self.calls = []

    def execute(self, query, params=None):
        self.calls.append((query, params))
        if self.failures:
            self.failures -= 1
            raise RuntimeError("transient database error")

    def fetchall(self):
        return self.rows


class SafeConversionTests(unittest.TestCase):
    def test_safe_decimal_preserves_decimal_precision_and_uses_default_for_none(self):
        self.assertEqual(safe_decimal("12.3400"), Decimal("12.3400"))
        self.assertEqual(safe_decimal(None), Decimal("0.0"))
        fallback = Decimal("-1")
        self.assertIs(safe_decimal(None, fallback), fallback)

    def test_safe_int_converts_integer_strings_and_falls_back_on_invalid_values(self):
        self.assertEqual(safe_int("42"), 42)
        self.assertEqual(safe_int(None), 0)
        self.assertEqual(safe_int("4.2", default=-1), -1)

    def test_safe_str_only_uses_default_for_none(self):
        self.assertEqual(safe_str(17), "17")
        self.assertEqual(safe_str(None), "")
        self.assertEqual(safe_str(None, default="unknown"), "unknown")


class CursorHelperTests(unittest.TestCase):
    def test_query_retry_succeeds_after_transient_failures_with_params(self):
        cursor = FakeCursor(failures=2)

        succeeded = execute_query_with_retry(
            cursor, "SELECT value WHERE id = %s", (7,), max_retries=3
        )

        self.assertTrue(succeeded)
        self.assertEqual(
            cursor.calls,
            [("SELECT value WHERE id = %s", (7,))] * 3,
        )

    def test_query_retry_reraises_after_final_failure(self):
        cursor = FakeCursor(failures=2)

        with self.assertRaisesRegex(RuntimeError, "transient database error"):
            execute_query_with_retry(cursor, "SELECT value", max_retries=2)

        self.assertEqual(len(cursor.calls), 2)

    def test_legacy_mapping_uses_legacy_ids_as_keys_and_lcfs_ids_as_values(self):
        # The fake cursor returns the rows selected by the SQL filter, as a DB cursor would.
        cursor = FakeCursor(rows=[(101, 1), (102, 2)])

        mapping = build_legacy_mapping(cursor, table_name="legacy_compliance_report")

        self.assertEqual(mapping, {1: 101, 2: 102})
        self.assertIn("FROM legacy_compliance_report", cursor.calls[0][0])
        self.assertIn("legacy_id IS NOT NULL", cursor.calls[0][0])
        self.assertEqual(cursor.calls[0][1], None)


if __name__ == "__main__":
    unittest.main()
