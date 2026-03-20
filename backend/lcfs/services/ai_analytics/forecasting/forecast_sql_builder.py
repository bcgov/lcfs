from __future__ import annotations

from typing import List, Optional

from lcfs.services.ai_analytics.forecasting.forecast_types import ForecastDatasetSpec
from lcfs.services.ai_analytics.types import ForecastPlan, QueryPlan, SchemaCatalog, SchemaEntity
from lcfs.settings import settings


class ForecastSqlBuilder:
    def build(
        self,
        plan: QueryPlan,
        forecast_plan: ForecastPlan,
        catalog: SchemaCatalog,
    ) -> ForecastDatasetSpec:
        entity = self._find_entity(forecast_plan.candidate_source_entity, catalog)
        if entity is None:
            raise ValueError("No grounded source entity was available for forecasting.")

        metric_column = self._resolve_metric_column(forecast_plan.target_metric, entity)
        time_column = self._resolve_time_column(forecast_plan.time_column, entity)
        grouping_columns = self._resolve_grouping_columns(forecast_plan.group_by, entity)
        if metric_column is None or time_column is None:
            raise ValueError("The forecast dataset is missing a metric or time column.")

        time_expr = self._time_bucket_expression(time_column, forecast_plan.granularity)
        metric_expr = 'COUNT(*) AS y' if metric_column == "__count__" else f'SUM("{metric_column}") AS y'
        select_columns = [f"{time_expr} AS ds", metric_expr]
        group_by = ["ds"]
        order_by = ["ds"]
        if grouping_columns:
            select_columns.extend(f'"{column}"' for column in grouping_columns)
            group_by.extend(f'"{column}"' for column in grouping_columns)
            order_by.extend(f'"{column}"' for column in grouping_columns)

        sql = (
            f"SELECT {', '.join(select_columns)} "
            f'FROM "{entity.schema_name}"."{entity.name}" '
            f"GROUP BY {', '.join(group_by)} "
            f"ORDER BY {', '.join(order_by)} "
            f"LIMIT {settings.ai_analytics_max_rows}"
        )
        return ForecastDatasetSpec(
            entity_name=entity.qualified_name,
            metric_column=metric_column,
            time_column=time_column,
            granularity=forecast_plan.granularity or "month",
            grouping_columns=grouping_columns,
            sql=sql,
        )

    def _find_entity(self, qualified_name: Optional[str], catalog: SchemaCatalog) -> Optional[SchemaEntity]:
        if qualified_name:
            for entity in catalog.entities:
                if entity.qualified_name == qualified_name:
                    return entity
        return next(iter(catalog.entities), None)

    def _resolve_metric_column(self, metric_name: Optional[str], entity: SchemaEntity) -> Optional[str]:
        if metric_name is None:
            return None
        lowered_metric = metric_name.lower()
        if lowered_metric in {"count", "report volume", "volume"}:
            return "__count__"
        metric_tokens = metric_name.lower().replace(" ", "_")
        for column in entity.columns:
            if metric_tokens in column.name.lower():
                return column.name
        for candidate in ("compliance_units", "lead_time_days", "cycle_time_days", "count"):
            for column in entity.columns:
                if candidate in column.name.lower():
                    return column.name
        return None

    def _resolve_time_column(self, requested_time: Optional[str], entity: SchemaEntity) -> Optional[str]:
        preferred = [requested_time or "", "compliance_period", "completion_year", "create_date", "update_date"]
        for candidate in preferred:
            normalized = candidate.lower().replace(" ", "_")
            for column in entity.columns:
                if normalized and normalized in column.name.lower():
                    return column.name
        return None

    def _resolve_grouping_columns(self, requested: List[str], entity: SchemaEntity) -> List[str]:
        resolved: List[str] = []
        for grouping in requested:
            normalized = grouping.lower().replace(" ", "_")
            for column in entity.columns:
                if normalized and normalized in column.name.lower():
                    resolved.append(column.name)
                    break
        return resolved

    def _time_bucket_expression(self, time_column: str, granularity: Optional[str]) -> str:
        mapping = {
            "day": "day",
            "week": "week",
            "month": "month",
            "quarter": "quarter",
            "year": "year",
        }
        bucket = mapping.get(granularity or "month", "month")
        return f"DATE_TRUNC('{bucket}', \"{time_column}\")"
