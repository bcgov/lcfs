from __future__ import annotations

import re
from typing import Optional

from lcfs.services.ai_analytics.types import ForecastPlan, QueryPlan, SchemaCatalog
from lcfs.settings import settings


class ForecastPlanner:
    FORECAST_TERMS = ("forecast", "predict", "project", "future", "next ", "upcoming")

    def detect(self, plan: QueryPlan, catalog: SchemaCatalog) -> Optional[ForecastPlan]:
        question = plan.question.lower()
        if not any(term in question for term in self.FORECAST_TERMS):
            return None

        metric_name = plan.metrics[0].name if plan.metrics else None
        time_column = self._infer_time_column(question)
        granularity = self._infer_granularity(question)
        horizon = self._infer_horizon(question)
        source_entity = plan.candidate_entities[0] if plan.candidate_entities else None

        ambiguities = []
        if metric_name is None:
            ambiguities.append("No numeric target metric was detected for forecasting.")
        if time_column is None:
            ambiguities.append("No clear time dimension was detected for forecasting.")

        return ForecastPlan(
            forecast_intent=True,
            target_metric=metric_name,
            time_column=time_column,
            group_by=[dimension.name for dimension in plan.dimensions if dimension.name != "year"],
            forecast_horizon=horizon,
            granularity=granularity,
            candidate_source_entity=source_entity,
            confidence=0.8 if not ambiguities else 0.55,
            ambiguities=ambiguities,
            explanation="Forecast plan inferred from explicit forecasting language and time-series requirements.",
        )

    def apply_to_query_plan(self, plan: QueryPlan, forecast_plan: ForecastPlan) -> QueryPlan:
        plan.mode = "forecast" if "historical" not in plan.question.lower() else "mixed"
        plan.forecast_intent = True
        plan.forecast_horizon = forecast_plan.forecast_horizon
        plan.forecast_granularity = forecast_plan.granularity
        plan.forecast_time_column = forecast_plan.time_column
        plan.forecast_grouping = forecast_plan.group_by
        plan.candidate_chart_type = "line"
        return plan

    def _infer_horizon(self, question: str) -> int:
        match = re.search(r"next\s+(\d+)\s+(day|week|month|quarter|year)", question)
        if match:
            return int(match.group(1))
        return settings.ai_analytics_default_forecast_horizon

    def _infer_granularity(self, question: str) -> str:
        if "quarter" in question:
            return "quarter"
        if "year" in question:
            return "year"
        if "week" in question:
            return "week"
        if "day" in question:
            return "day"
        return "month"

    def _infer_time_column(self, question: str) -> Optional[str]:
        if "quarter" in question or "month" in question or "year" in question:
            return "compliance_period"
        if "date" in question or "day" in question:
            return "create_date"
        if "trend" in question:
            return "completion_year"
        return "compliance_period"
