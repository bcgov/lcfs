"""Helpers for writing untrusted values to spreadsheet formats safely."""

from typing import Any


FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def is_formula_like_string(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    if value.startswith(FORMULA_PREFIXES):
        return True
    trimmed = value.lstrip()
    return trimmed != value and trimmed.startswith(("=", "+", "-", "@"))


def sanitize_spreadsheet_value(value: Any) -> Any:
    """Prefix formula-like strings for text formats such as CSV."""
    if is_formula_like_string(value):
        return f"'{value}"
    return value


def set_spreadsheet_cell_value(cell, value: Any) -> None:
    """Write a value unchanged and mark formula-like strings as literal text."""
    cell.value = value
    if is_formula_like_string(value):
        cell.data_type = "s"


def append_spreadsheet_row(worksheet, values) -> None:
    """Append a row while preserving formula-like strings as their original text."""
    worksheet.append(values)
    for cell, value in zip(worksheet[worksheet.max_row], values):
        if is_formula_like_string(value):
            set_spreadsheet_cell_value(cell, value)
