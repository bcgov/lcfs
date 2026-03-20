from __future__ import annotations

from hashlib import md5
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.services.ai_analytics.chart_builder import ResultAnalyzer
from lcfs.services.ai_analytics.forecasting.forecast_chart_builder import (
    ForecastChartBuilder,
)
from lcfs.services.ai_analytics.forecasting.forecast_planner import ForecastPlanner
from lcfs.services.ai_analytics.forecasting.forecast_sql_builder import ForecastSqlBuilder
from lcfs.services.ai_analytics.forecasting.forecast_types import (
    ForecastExecutionResult,
    ForecastModelInfo,
)
from lcfs.services.ai_analytics.forecasting.mindsdb_client import MindsdbClient
from lcfs.services.ai_analytics.types import ForecastPlan, QueryPlan, SchemaCatalog
from lcfs.settings import settings


class ForecastingService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.forecast_planner = ForecastPlanner()
        self.sql_builder = ForecastSqlBuilder()
        self.mindsdb_client = (
            MindsdbClient() if settings.ai_analytics_mindsdb_base_url else None
        )
        self.chart_builder = ForecastChartBuilder()
        self.analyzer = ResultAnalyzer()

    def maybe_build_forecast_plan(
        self, plan: QueryPlan, catalog: SchemaCatalog
    ) -> Optional[ForecastPlan]:
        forecast_plan = self.forecast_planner.detect(plan, catalog)
        if forecast_plan:
            self.forecast_planner.apply_to_query_plan(plan, forecast_plan)
        return forecast_plan

    async def run_forecast(self, plan: QueryPlan, forecast_plan: ForecastPlan, catalog: SchemaCatalog):
        dataset_spec = self.sql_builder.build(plan, forecast_plan, catalog)
        historical_rows = await self._fetch_training_rows(dataset_spec.sql)
        warnings: List[str] = []
        assumptions: List[str] = []

        if len(historical_rows) < settings.ai_analytics_min_forecast_points:
            raise ValueError(
                f"At least {settings.ai_analytics_min_forecast_points} historical points are required for forecasting."
            )

        model_name = self._derive_model_name(dataset_spec.entity_name, dataset_spec.metric_column, dataset_spec.granularity, dataset_spec.grouping_columns)
        if self.mindsdb_client is None:
            raise ValueError("MindsDB is not configured.")
        model_info = await self.mindsdb_client.create_or_retrain_model(
            model_name=model_name,
            training_sql=dataset_spec.sql,
            horizon=forecast_plan.forecast_horizon,
        )
        predictions = await self.mindsdb_client.predict(
            model_name=model_name,
            horizon=forecast_plan.forecast_horizon,
        )
        forecast_rows = [
            {
                "ds": prediction.ds,
                "y": prediction.y,
                "group_value": prediction.group_value,
                "lower": prediction.lower,
                "upper": prediction.upper,
            }
            for prediction in predictions
        ]
        combined = [
            {"period": str(row["ds"]), "value": float(row["y"]), "kind": "historical"}
            for row in historical_rows
        ] + [
            {"period": prediction.ds, "value": prediction.y, "kind": "forecast"}
            for prediction in predictions
        ]
        result = ForecastExecutionResult(
            historical_rows=historical_rows,
            forecast_rows=forecast_rows,
            combined_series=combined,
            model_info=model_info,
            assumptions=assumptions,
            warnings=warnings,
        )
        chart = self.chart_builder.build(
            f"{forecast_plan.target_metric} forecast",
            result,
        )
        return result, chart, dataset_spec

    async def _fetch_training_rows(self, sql: str):
        result = await self.db.execute(text(sql))
        return [dict(row) for row in result.mappings().all()]

    def _derive_model_name(
        self,
        entity_name: str,
        metric_column: str,
        granularity: str,
        grouping_columns: List[str],
    ) -> str:
        raw = f"{entity_name}:{metric_column}:{granularity}:{','.join(grouping_columns)}"
        suffix = md5(raw.encode("utf-8")).hexdigest()[:10]
        safe_entity = entity_name.replace(".", "_")
        return f"forecast_{safe_entity}_{metric_column}_{granularity}_{suffix}"
