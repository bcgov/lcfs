import pytest

from lcfs.services.ai_analytics.sql_validator import SqlSafetyValidator
from lcfs.services.ai_analytics.types import GeneratedSql, SchemaCatalog, SchemaColumn, SchemaEntity


def build_catalog():
    return SchemaCatalog(
        entities=[
            SchemaEntity(
                name="mv_credit_ledger",
                schema_name="public",
                entity_type="materialized_view",
                columns=[
                    SchemaColumn(name="compliance_period", data_type="text"),
                    SchemaColumn(name="compliance_units", data_type="integer"),
                ],
            )
        ],
        generated_at="2026-03-19T00:00:00Z",
    )


def test_sql_validator_allows_safe_select():
    validator = SqlSafetyValidator()

    generated_sql = GeneratedSql(
        sql='SELECT "compliance_period", SUM("compliance_units") AS "value" FROM "public"."mv_credit_ledger" GROUP BY "compliance_period"',
        entity_name="public.mv_credit_ledger",
        entity_type="materialized_view",
        used_columns=["compliance_period", "compliance_units"],
        applied_limit=100,
    )

    validator.validate(generated_sql, build_catalog())


def test_sql_validator_rejects_mutation_keywords():
    validator = SqlSafetyValidator()
    generated_sql = GeneratedSql(
        sql='DELETE FROM "public"."mv_credit_ledger"',
        entity_name="public.mv_credit_ledger",
        entity_type="materialized_view",
        used_columns=["compliance_units"],
    )

    with pytest.raises(ValueError):
        validator.validate(generated_sql, build_catalog())
