from __future__ import annotations

from typing import List, Optional, Sequence, Tuple

from lcfs.services.ai_analytics.types import (
    GeneratedSql,
    QueryDimension,
    QueryFilter,
    QueryMetric,
    QueryPlan,
    SchemaCatalog,
    SchemaColumn,
    SchemaEntity,
)
from lcfs.settings import settings


class SqlGenerator:
    """Generates read-only SQL from a structured plan and grounded schema catalog."""

    def generate(self, plan: QueryPlan, catalog: SchemaCatalog) -> GeneratedSql:
        entity = self._select_entity(plan, catalog)
        if not entity:
            raise ValueError(
                "The assistant could not find a grounded entity for this question."
            )

        metric = self._resolve_metric(plan.metrics[0] if plan.metrics else None, entity)
        dimensions = self._resolve_dimensions(plan.dimensions, entity)
        filters = self._resolve_filters(plan.filters, entity)
        limit = min(settings.ai_analytics_default_limit, settings.ai_analytics_max_rows)

        sql, used_columns, assumptions = self._build_query(
            plan=plan,
            entity=entity,
            metric=metric,
            dimensions=dimensions,
            filters=filters,
            limit=limit,
        )

        return GeneratedSql(
            sql=sql,
            entity_name=entity.qualified_name,
            entity_type=entity.entity_type,
            used_columns=used_columns,
            applied_limit=limit,
            chart_type=plan.candidate_chart_type,
            assumptions=assumptions,
            warnings=list(plan.warnings),
        )

    def _select_entity(self, plan: QueryPlan, catalog: SchemaCatalog) -> Optional[SchemaEntity]:
        candidates = plan.candidate_entities or [
            entity.qualified_name for entity in catalog.entities
        ]
        catalog_map = {entity.qualified_name: entity for entity in catalog.entities}

        best_score = -1
        best_entity: Optional[SchemaEntity] = None
        for candidate in candidates:
            entity = catalog_map.get(candidate)
            if not entity:
                continue
            score = 0
            if entity.preferred_for_analytics:
                score += 5
            if self._resolve_metric(plan.metrics[0] if plan.metrics else None, entity):
                score += 5
            score += len(self._resolve_dimensions(plan.dimensions, entity)) * 3
            score += len(self._resolve_filters(plan.filters, entity)) * 2
            if score > best_score:
                best_score = score
                best_entity = entity
        return best_entity

    def _find_best_column(
        self,
        entity: SchemaEntity,
        options: Sequence[str],
    ) -> Optional[SchemaColumn]:
        for option in options:
            normalized = option.lower().replace(" ", "_")
            for column in entity.columns:
                column_name = column.name.lower()
                if column_name == normalized or normalized in column_name:
                    return column
        for option in options:
            lowered = option.lower()
            for column in entity.columns:
                if lowered in " ".join(column.semantic_tags).lower():
                    return column
        return None

    def _resolve_metric(
        self,
        metric: Optional[QueryMetric],
        entity: SchemaEntity,
    ) -> Optional[Tuple[QueryMetric, Optional[SchemaColumn]]]:
        if not metric:
            return None
        if metric.aggregation == "count":
            return metric, None
        candidates = {
            "credits": [
                "compliance_units",
                "credits",
                "credit",
                "quantity",
                "total_credits",
            ],
            "processing time": [
                "lead_time_days",
                "cycle_time_days",
                "processing_time_days",
                "days_in_status",
            ],
            "available balance": ["available_balance", "balance"],
        }.get(metric.name.lower(), [metric.name])
        column = self._find_best_column(entity, candidates)
        if not column:
            return None
        metric.resolved_column = column.name
        return metric, column

    def _resolve_dimensions(
        self,
        dimensions: List[QueryDimension],
        entity: SchemaEntity,
    ) -> List[Tuple[QueryDimension, SchemaColumn]]:
        resolved: List[Tuple[QueryDimension, SchemaColumn]] = []
        for dimension in dimensions:
            name = dimension.name.lower().strip()
            options = [name]
            if "year" in name or "period" in name:
                options.extend(
                    ["compliance_period", "completion_year", "year", "create_date"]
                )
            if "organization" in name or "supplier" in name:
                options.extend(["organization_name", "organization_id", "supplier_name"])
            if "fuel" in name or "category" in name:
                options.extend(["fuel_category", "fuel_type", "fuel_name"])
            if "status" in name or "stage" in name:
                options.extend(["status", "report_status", "workflow_stage"])
            column = self._find_best_column(entity, options)
            if column:
                dimension.resolved_column = column.name
                resolved.append((dimension, column))
        return resolved

    def _resolve_filters(
        self,
        filters: List[QueryFilter],
        entity: SchemaEntity,
    ) -> List[Tuple[QueryFilter, SchemaColumn]]:
        resolved: List[Tuple[QueryFilter, SchemaColumn]] = []
        for filter_item in filters:
            options = [filter_item.field]
            if filter_item.field == "year":
                options.extend(["compliance_period", "completion_year", "year"])
            if filter_item.field in {"organization_id", "organization_name", "organization"}:
                options.extend(
                    [
                        "organization_name",
                        "organization_id",
                        "supplier_name",
                        "supplier_id",
                    ]
                )
            column = self._find_best_column(entity, options)
            if column:
                filter_item.resolved_column = column.name
                resolved.append((filter_item, column))
        return resolved

    def _is_numeric_type(self, data_type: str) -> bool:
        lowered = (data_type or "").lower()
        numeric_markers = [
            "int",
            "numeric",
            "decimal",
            "double",
            "real",
            "float",
        ]
        return any(marker in lowered for marker in numeric_markers)

    def _format_literal(self, column: SchemaColumn, value) -> str:
        if value is None:
            return "NULL"
        if self._is_numeric_type(column.data_type):
            return str(value)
        escaped = str(value).replace("'", "''")
        return f"'{escaped}'"

    def _format_filter(self, column: SchemaColumn, filter_item: QueryFilter) -> str:
        if filter_item.operator == "=":
            return f'"{column.name}" = {self._format_literal(column, filter_item.value)}'
        if filter_item.operator == "in":
            values = ", ".join(
                self._format_literal(column, value) for value in filter_item.value
            )
            return f'"{column.name}" IN ({values})'
        if filter_item.operator == "ilike":
            escaped = str(filter_item.value).replace("'", "''")
            return f'"{column.name}" ILIKE \'%{escaped}%\''
        raise ValueError(f"Unsupported filter operator: {filter_item.operator}")

    def _select_detail_columns(self, entity: SchemaEntity, max_columns: int) -> List[str]:
        selected_columns: List[str] = []
        available_names = {column.name for column in entity.columns}
        replacement_map = {
            "organization_id": "organization_name",
            "supplier_id": "supplier_name",
        }

        for column in entity.columns:
            target_name = replacement_map.get(column.name, column.name)
            if target_name in available_names and target_name not in selected_columns:
                selected_columns.append(target_name)
            elif column.name not in replacement_map and column.name not in selected_columns:
                selected_columns.append(column.name)

            if len(selected_columns) >= max_columns:
                break

        return selected_columns

    def _build_query(
        self,
        plan: QueryPlan,
        entity: SchemaEntity,
        metric: Optional[Tuple[QueryMetric, Optional[SchemaColumn]]],
        dimensions: List[Tuple[QueryDimension, SchemaColumn]],
        filters: List[Tuple[QueryFilter, SchemaColumn]],
        limit: int,
    ) -> Tuple[str, List[str], List[str]]:
        used_columns: List[str] = []
        assumptions: List[str] = []
        from_clause = f'"{entity.schema_name}"."{entity.name}"'
        where_clause = ""
        if filters:
            where_clause = " WHERE " + " AND ".join(
                self._format_filter(column, filter_item)
                for filter_item, column in filters
            )
            used_columns.extend(column.name for _, column in filters)

        if metric is None:
            selected_columns = self._select_detail_columns(
                entity, min(8, len(entity.columns))
            )
            used_columns.extend(selected_columns)
            select_sql = ", ".join(f'"{column}"' for column in selected_columns)
            sql = f"SELECT {select_sql} FROM {from_clause}{where_clause} LIMIT {limit}"
            assumptions.append(
                "No explicit metric was found, so a limited detail query was generated."
            )
            return sql, used_columns, assumptions

        metric_request, metric_column = metric
        if metric_request.aggregation == "count":
            metric_sql = 'COUNT(*) AS "value"'
            used_columns.append("*")
        else:
            metric_sql = (
                f'{metric_request.aggregation.upper()}("{metric_column.name}") AS "value"'
            )
            used_columns.append(metric_column.name)

        if self._is_drop_comparison(plan) and dimensions and filters:
            year_filter = next((flt for flt, _ in filters if flt.field == "year"), None)
            year_column = next((column for flt, column in filters if flt.field == "year"), None)
            if (
                year_filter
                and year_column
                and isinstance(year_filter.value, list)
                and len(year_filter.value) >= 2
                and metric_column is not None
            ):
                comparison_dim = dimensions[0][1].name
                first_year, second_year = year_filter.value[:2]
                first_year_literal = self._format_literal(year_column, first_year)
                second_year_literal = self._format_literal(year_column, second_year)
                sql = (
                    f'SELECT "{comparison_dim}" AS "dimension", '
                    f'SUM(CASE WHEN "{year_column.name}" = {first_year_literal} THEN "{metric_column.name}" ELSE 0 END) AS "value_{first_year}", '
                    f'SUM(CASE WHEN "{year_column.name}" = {second_year_literal} THEN "{metric_column.name}" ELSE 0 END) AS "value_{second_year}", '
                    f'SUM(CASE WHEN "{year_column.name}" = {second_year_literal} THEN "{metric_column.name}" ELSE 0 END) - '
                    f'SUM(CASE WHEN "{year_column.name}" = {first_year_literal} THEN "{metric_column.name}" ELSE 0 END) AS "value" '
                    f"FROM {from_clause}{where_clause} "
                    f'GROUP BY "{comparison_dim}" ORDER BY "value" ASC LIMIT {limit}'
                )
                used_columns.append(comparison_dim)
                assumptions.append(
                    "A year-over-year delta query was generated because the question asked for the largest drop."
                )
                return sql, used_columns, assumptions

        if dimensions:
            dimension_sql = ", ".join(
                f'"{column.name}" AS "{dimension.name}"' for dimension, column in dimensions
            )
            group_sql = ", ".join(f'"{column.name}"' for _, column in dimensions)
            order_sql = group_sql
            used_columns.extend(column.name for _, column in dimensions)
            sql = (
                f'SELECT {dimension_sql}, {metric_sql} FROM {from_clause}{where_clause} '
                f"GROUP BY {group_sql} ORDER BY {order_sql} LIMIT {limit}"
            )
            return sql, used_columns, assumptions

        sql = f"SELECT {metric_sql} FROM {from_clause}{where_clause}"
        return sql, used_columns, assumptions

    def _is_drop_comparison(self, plan: QueryPlan) -> bool:
        lowered = plan.question.lower()
        return "drop" in lowered or "decrease" in lowered or "largest drop" in lowered
