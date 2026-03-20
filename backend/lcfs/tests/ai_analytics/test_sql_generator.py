from lcfs.services.ai_analytics.sql_generator import SqlGenerator
from lcfs.services.ai_analytics.types import (
    QueryDimension,
    QueryFilter,
    QueryMetric,
    QueryPlan,
    SchemaCatalog,
    SchemaColumn,
    SchemaEntity,
)


def build_catalog():
    return SchemaCatalog(
        entities=[
            SchemaEntity(
                name="mv_credit_ledger",
                schema_name="public",
                entity_type="materialized_view",
                preferred_for_analytics=True,
                semantic_tags=["credits", "organization", "compliance_period"],
                columns=[
                    SchemaColumn(name="organization_id", data_type="integer"),
                    SchemaColumn(name="organization_name", data_type="text"),
                    SchemaColumn(name="compliance_period", data_type="text"),
                    SchemaColumn(name="compliance_units", data_type="integer"),
                ],
            )
        ],
        generated_at="2026-03-19T00:00:00Z",
    )


def test_sql_generator_builds_grouped_aggregation():
    generator = SqlGenerator()
    plan = QueryPlan(
        question="Show total credits by compliance period",
        intent="aggregation",
        metrics=[QueryMetric(name="credits", aggregation="sum")],
        dimensions=[QueryDimension(name="compliance period")],
        filters=[],
        candidate_entities=["public.mv_credit_ledger"],
        candidate_chart_type="bar",
        explanation="test",
        confidence=0.9,
    )

    generated = generator.generate(plan, build_catalog())

    assert 'SUM("compliance_units") AS "value"' in generated.sql
    assert '"compliance_period" AS "compliance period"' in generated.sql
    assert generated.entity_name == "public.mv_credit_ledger"


def test_sql_generator_builds_year_drop_query():
    generator = SqlGenerator()
    plan = QueryPlan(
        question="Which organizations had the largest drop in credits from 2022 to 2023?",
        intent="aggregation",
        metrics=[QueryMetric(name="credits", aggregation="sum")],
        dimensions=[QueryDimension(name="organization")],
        filters=[QueryFilter(field="year", operator="in", value=[2022, 2023])],
        candidate_entities=["public.mv_credit_ledger"],
        candidate_chart_type="bar",
        explanation="test",
        confidence=0.9,
    )

    catalog = build_catalog()
    catalog.entities[0].columns.append(
        SchemaColumn(name="year", data_type="integer")
    )

    generated = generator.generate(plan, catalog)

    assert "CASE WHEN" in generated.sql
    assert 'ORDER BY "value" ASC' in generated.sql


def test_sql_generator_quotes_text_year_filters():
    generator = SqlGenerator()
    plan = QueryPlan(
        question="Compare organizations by total credits in 2024",
        intent="aggregation",
        metrics=[QueryMetric(name="credits", aggregation="sum")],
        dimensions=[QueryDimension(name="organization")],
        filters=[QueryFilter(field="year", operator="=", value=2024)],
        candidate_entities=["public.mv_credit_ledger"],
        candidate_chart_type="bar",
        explanation="test",
        confidence=0.9,
    )

    catalog = build_catalog()
    catalog.entities[0].columns.append(
        SchemaColumn(name="compliance_year", data_type="character varying")
    )

    generated = generator.generate(plan, catalog)

    assert '"compliance_year" = \'2024\'' in generated.sql


def test_sql_generator_prefers_organization_name_in_detail_queries():
    generator = SqlGenerator()
    plan = QueryPlan(
        question="List fuel supply records",
        intent="detail",
        metrics=[],
        dimensions=[],
        filters=[],
        candidate_entities=["public.mv_credit_ledger"],
        candidate_chart_type="table",
        explanation="test",
        confidence=0.9,
    )

    catalog = build_catalog()
    catalog.entities[0].columns.insert(
        0, SchemaColumn(name="organization_id", data_type="integer")
    )

    generated = generator.generate(plan, catalog)

    assert '"organization_name"' in generated.sql


def test_sql_generator_applies_organization_id_filter():
    generator = SqlGenerator()
    plan = QueryPlan(
        question="Show total credits by compliance period for org id 4",
        intent="aggregation",
        metrics=[QueryMetric(name="credits", aggregation="sum")],
        dimensions=[QueryDimension(name="compliance period")],
        filters=[QueryFilter(field="organization_id", operator="=", value=4)],
        candidate_entities=["public.mv_credit_ledger"],
        candidate_chart_type="bar",
        explanation="test",
        confidence=0.9,
    )

    generated = generator.generate(plan, build_catalog())

    assert '"organization_id" = 4' in generated.sql
