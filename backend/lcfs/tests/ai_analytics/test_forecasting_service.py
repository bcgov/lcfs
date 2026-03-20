import pytest

from lcfs.services.ai_analytics.forecasting.forecasting_service import ForecastingService
from lcfs.services.ai_analytics.types import ForecastPlan, QueryMetric, QueryPlan, SchemaCatalog, SchemaColumn, SchemaEntity


class FakeMindsdbClient:
    async def create_or_retrain_model(self, model_name, training_sql, horizon, order_by="ds"):
        from lcfs.services.ai_analytics.forecasting.forecast_types import ForecastModelInfo

        return ForecastModelInfo(model_name=model_name, reused=True, trained=False)

    async def predict(self, model_name, horizon):
        from lcfs.services.ai_analytics.forecasting.forecast_types import MindsdbPredictionRow

        return [MindsdbPredictionRow(ds="2025-01-01", y=11.0)]


@pytest.mark.anyio
async def test_forecasting_service_requires_minimum_history(dbsession, monkeypatch):
    service = ForecastingService(dbsession)
    service.mindsdb_client = FakeMindsdbClient()
    async def fake_fetch(sql):
        return [{"ds": "2024-01-01", "y": 1.0}]

    monkeypatch.setattr(service, "_fetch_training_rows", fake_fetch)
    catalog = SchemaCatalog(
        entities=[
            SchemaEntity(
                name="mv_credit_ledger",
                schema_name="public",
                entity_type="materialized_view",
                columns=[
                    SchemaColumn(name="compliance_period", data_type="timestamp"),
                    SchemaColumn(name="compliance_units", data_type="integer"),
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
        forecast_intent=True,
        forecast_horizon=12,
        forecast_granularity="month",
    )
    forecast_plan = ForecastPlan(
        forecast_intent=True,
        target_metric="credits",
        time_column="compliance_period",
        forecast_horizon=12,
        granularity="month",
        candidate_source_entity="public.mv_credit_ledger",
    )

    with pytest.raises(ValueError):
        await service.run_forecast(plan, forecast_plan, catalog)
