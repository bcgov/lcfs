from __future__ import annotations

from typing import List, Optional

from lcfs.services.ai_analytics.forecasting.forecast_types import ForecastDatasetSpec
from lcfs.services.ai_analytics.types import (
    ForecastPlan,
    QueryPlan,
    SchemaCatalog,
    SchemaColumn,
    SchemaEntity,
)
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

        effective_granularity = self._effective_granularity(
            time_column, forecast_plan.granularity
        )
        time_expr = self._time_bucket_expression(time_column, effective_granularity)
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
            time_column=time_column.name,
            granularity=effective_granularity,
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
        for candidate in (
            "compliance_units",
            "credits",
            "total_credits",
            "quantity",
            "lead_time_days",
            "cycle_time_days",
            "processing_time_days",
            "count",
        ):
            for column in entity.columns:
                if candidate in column.name.lower():
                    return column.name
        return None

    def _resolve_time_column(
        self, requested_time: Optional[str], entity: SchemaEntity
    ) -> Optional[SchemaColumn]:
        preferred = [
            requested_time or "",
            "compliance_period",
            "compliance_year",
            "completion_year",
            "year",
            "create_date",
            "update_date",
            "transaction_date",
            "approval_date",
            "application_date",
            "effective_date",
        ]
        for candidate in preferred:
            normalized = candidate.lower().replace(" ", "_")
            for column in entity.columns:
                if normalized and normalized in column.name.lower():
                    return column
        for column in entity.columns:
            column_name = column.name.lower()
            if any(
                token in column_name
                for token in ("date", "year", "month", "quarter", "period")
            ):
                return column
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

    def _effective_granularity(
        self, time_column: SchemaColumn, granularity: Optional[str]
    ) -> str:
        requested = granularity or "month"
        if self._is_year_like_column(time_column):
            return "year"
        return requested

    def _is_year_like_column(self, time_column: SchemaColumn) -> bool:
        column_name = time_column.name.lower()
        data_type = time_column.data_type.lower()
        return (
            "year" in column_name
            or "period" in column_name
            or data_type in {"integer", "bigint", "smallint"}
        ) and "date" not in column_name

    def _time_bucket_expression(
        self, time_column: SchemaColumn, granularity: Optional[str]
    ) -> str:
        mapping = {
            "day": "day",
            "week": "week",
            "month": "month",
            "quarter": "quarter",
            "year": "year",
        }
        bucket = mapping.get(granularity or "month", "month")
        if self._is_year_like_column(time_column):
            return (
                f"DATE_TRUNC('{bucket}', TO_DATE(\"{time_column.name}\"::text, 'YYYY'))"
            )
        return f"DATE_TRUNC('{bucket}', \"{time_column.name}\")"
