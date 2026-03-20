from lcfs.services.ai_analytics.forecasting.forecast_sql_builder import ForecastSqlBuilder
from lcfs.services.ai_analytics.types import ForecastPlan, QueryMetric, QueryPlan, SchemaCatalog, SchemaColumn, SchemaEntity


def test_forecast_sql_builder_generates_time_series_sql():
    builder = ForecastSqlBuilder()
    catalog = SchemaCatalog(
        entities=[
            SchemaEntity(
                name="mv_credit_ledger",
                schema_name="public",
                entity_type="materialized_view",
                columns=[
                    SchemaColumn(name="compliance_period", data_type="timestamp"),
                    SchemaColumn(name="compliance_units", data_type="integer"),
                    SchemaColumn(name="organization_name", data_type="text"),
                ],
            )
        ],
        generated_at="2026-03-19T00:00:00Z",
    )
    plan = QueryPlan(
        question="Forecast total credits for the next 12 months",
        intent="aggregation",
        metrics=[QueryMetric(name="credits", aggregation="sum")],
        candidate_entities=["public.mv_credit_ledger"],
        explanation="test",
        confidence=0.8,
    )
    forecast_plan = ForecastPlan(
        forecast_intent=True,
        target_metric="credits",
        time_column="compliance_period",
        forecast_horizon=12,
        granularity="month",
        candidate_source_entity="public.mv_credit_ledger",
    )

    dataset = builder.build(plan, forecast_plan, catalog)

    assert "DATE_TRUNC('month'" in dataset.sql
    assert 'SUM("compliance_units") AS y' in dataset.sql
