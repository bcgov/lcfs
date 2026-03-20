from __future__ import annotations

from typing import Any, Dict, List

import httpx

from lcfs.services.ai_analytics.forecasting.forecast_types import (
    ForecastModelInfo,
    MindsdbPredictionRow,
)
from lcfs.settings import settings


class MindsdbClient:
    def __init__(self):
        self.client = httpx.AsyncClient(
            base_url=settings.ai_analytics_mindsdb_base_url,
            timeout=settings.ai_analytics_mindsdb_timeout_seconds,
        )

    async def health_check(self) -> bool:
        response = await self.client.get("/health")
        return response.status_code == 200

    async def execute_sql(self, sql: str) -> Dict[str, Any]:
        response = await self.client.post(
            settings.ai_analytics_mindsdb_sql_path,
            json={"query": sql},
        )
        response.raise_for_status()
        return response.json()

    async def model_exists(self, model_name: str) -> bool:
        result = await self.execute_sql(
            f"SHOW MODELS LIKE '{model_name}' FROM {settings.ai_analytics_mindsdb_project};"
        )
        return bool(result.get("data") or result.get("results"))

    async def create_or_retrain_model(
        self,
        model_name: str,
        training_sql: str,
        horizon: int,
        order_by: str = "ds",
    ) -> ForecastModelInfo:
        reused = await self.model_exists(model_name)
        if reused:
            return ForecastModelInfo(model_name=model_name, reused=True, trained=False)
        sql = (
            f"CREATE MODEL {settings.ai_analytics_mindsdb_project}.{model_name} "
            f"FROM {settings.ai_analytics_mindsdb_postgres_integration} "
            f"({training_sql}) PREDICT y ORDER BY {order_by} HORIZON {horizon};"
        )
        await self.execute_sql(sql)
        return ForecastModelInfo(model_name=model_name, reused=False, trained=True)

    async def predict(
        self,
        model_name: str,
        horizon: int,
    ) -> List[MindsdbPredictionRow]:
        sql = (
            f"SELECT ds, y FROM {settings.ai_analytics_mindsdb_project}.{model_name} "
            f"LIMIT {horizon};"
        )
        result = await self.execute_sql(sql)
        rows = result.get("data") or result.get("results") or []
        predictions: List[MindsdbPredictionRow] = []
        for row in rows:
            predictions.append(
                MindsdbPredictionRow(
                    ds=str(row.get("ds")),
                    y=float(row.get("y")),
                    group_value=row.get("group_value"),
                    lower=float(row["lower"]) if row.get("lower") is not None else None,
                    upper=float(row["upper"]) if row.get("upper") is not None else None,
                )
            )
        return predictions
