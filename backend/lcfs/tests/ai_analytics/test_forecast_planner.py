from lcfs.services.ai_analytics.forecasting.forecast_planner import ForecastPlanner
from lcfs.services.ai_analytics.types import QueryMetric, QueryPlan, SchemaCatalog, SchemaEntity


def build_catalog():
    return SchemaCatalog(
        entities=[
            SchemaEntity(
                name="mv_credit_ledger",
                schema_name="public",
                entity_type="materialized_view",
                preferred_for_analytics=True,
            )
        ],
        generated_at="2026-03-19T00:00:00Z",
    )


def test_forecast_planner_detects_forecast_intent():
    planner = ForecastPlanner()
    plan = QueryPlan(
        question="Forecast total credits for the next 12 months",
        intent="aggregation",
        metrics=[QueryMetric(name="credits", aggregation="sum")],
        candidate_entities=["public.mv_credit_ledger"],
        explanation="test",
        confidence=0.8,
    )

    forecast_plan = planner.detect(plan, build_catalog())

    assert forecast_plan is not None
    assert forecast_plan.forecast_intent is True
    assert forecast_plan.forecast_horizon == 12
    assert forecast_plan.granularity == "month"
