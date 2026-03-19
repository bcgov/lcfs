from __future__ import annotations

import re
from typing import List, Optional, Tuple

from lcfs.services.ai_analytics.semantic_registry import SYNONYMS
from lcfs.services.ai_analytics.types import (
    LlmPlanPayload,
    QueryDimension,
    QueryFilter,
    QueryMetric,
    QueryPlan,
    SchemaCatalog,
    SessionContext,
)


class QueryPlanner:
    """Structured, grounded plan builder."""

    YEAR_PATTERN = re.compile(r"\b(20\d{2})\b")

    def create_plan(
        self,
        question: str,
        catalog: SchemaCatalog,
        session_context: Optional[SessionContext] = None,
    ) -> QueryPlan:
        lowered = question.lower().strip()
        if session_context and self._looks_like_follow_up(lowered):
            return self._build_follow_up_plan(question, session_context)

        metric = self._infer_metric(lowered)
        dimensions = self._infer_dimensions(lowered)
        filters = self._infer_filters(lowered)
        chart_type = self._infer_chart_type(lowered)
        candidate_entities = self._rank_entities(question, catalog)
        ambiguities: List[str] = []
        warnings: List[str] = []

        if not candidate_entities:
            warnings.append(
                "No strongly matching entity was found in the live schema catalog."
            )
        if not metric:
            ambiguities.append("No explicit metric was identified from the question.")

        intent = "aggregation"
        if any(term in lowered for term in ["list", "show rows", "detail", "records"]):
            intent = "detail"

        explanation_parts = []
        if candidate_entities:
            explanation_parts.append(
                f"Top grounded entity candidates: {', '.join(candidate_entities[:3])}."
            )
        if metric:
            explanation_parts.append(f"Primary metric interpreted as {metric.name}.")
        if dimensions:
            explanation_parts.append(
                f"Requested grouping interpreted as {', '.join(dimension.name for dimension in dimensions)}."
            )
        if filters:
            explanation_parts.append(
                f"Detected filters: {', '.join(f'{flt.field} {flt.operator} {flt.value}' for flt in filters)}."
            )

        confidence = 0.45
        if candidate_entities:
            confidence += 0.2
        if metric:
            confidence += 0.15
        if dimensions or filters:
            confidence += 0.1
        confidence = min(confidence, 0.95)

        return QueryPlan(
            question=question,
            intent=intent,
            metrics=[metric] if metric else [],
            dimensions=dimensions,
            filters=filters,
            timeframe=self._infer_timeframe(filters),
            candidate_entities=candidate_entities[:5],
            candidate_chart_type=chart_type,
            explanation=" ".join(explanation_parts)
            or "Plan based on grounded schema entity and column matching.",
            confidence=confidence,
            ambiguities=ambiguities,
            warnings=warnings,
        )

    def merge_llm_plan(
        self,
        base_plan: QueryPlan,
        llm_plan: LlmPlanPayload,
        catalog: SchemaCatalog,
    ) -> QueryPlan:
        candidate_entities = llm_plan.entities or base_plan.candidate_entities
        if candidate_entities:
            known_entities = {entity.qualified_name for entity in catalog.entities}
            candidate_entities = [
                entity_name
                for entity_name in candidate_entities
                if entity_name in known_entities
            ] or base_plan.candidate_entities

        metrics = (
            [QueryMetric(name=metric_name) for metric_name in llm_plan.metrics]
            if llm_plan.metrics
            else base_plan.metrics
        )
        dimensions = (
            [QueryDimension(name=dimension_name) for dimension_name in llm_plan.dimensions]
            if llm_plan.dimensions
            else base_plan.dimensions
        )
        filters = base_plan.filters
        if llm_plan.filters:
            parsed_filters: List[QueryFilter] = []
            for filter_item in llm_plan.filters:
                if all(key in filter_item for key in ("field", "operator", "value")):
                    parsed_filters.append(
                        QueryFilter(
                            field=str(filter_item["field"]),
                            operator=str(filter_item["operator"]),
                            value=filter_item["value"],
                        )
                    )
            if parsed_filters:
                filters = parsed_filters

        return QueryPlan(
            question=base_plan.question,
            execution_mode=base_plan.execution_mode,
            llm_provider=base_plan.llm_provider,
            model_name=base_plan.model_name,
            intent=llm_plan.intent or base_plan.intent,
            metrics=metrics,
            dimensions=dimensions,
            filters=filters,
            timeframe=llm_plan.timeframe or base_plan.timeframe,
            candidate_entities=candidate_entities,
            candidate_chart_type=llm_plan.chart_type or base_plan.candidate_chart_type,
            explanation=llm_plan.explanation or base_plan.explanation,
            confidence=max(base_plan.confidence, min(llm_plan.confidence, 0.99)),
            ambiguities=llm_plan.ambiguities or base_plan.ambiguities,
            warnings=base_plan.warnings,
            follow_up_of=base_plan.follow_up_of,
        )

    def _looks_like_follow_up(self, question: str) -> bool:
        starters = [
            "show this",
            "break this down",
            "filter to",
            "compare with",
            "make this",
            "show it",
            "show by",
        ]
        return any(question.startswith(starter) for starter in starters)

    def _build_follow_up_plan(
        self,
        question: str,
        session_context: SessionContext,
    ) -> QueryPlan:
        last_plan = session_context.last_plan
        if not last_plan:
            raise ValueError("No prior session context is available for this follow-up.")

        lowered = question.lower().strip()
        dimensions = list(last_plan.dimensions)
        filters = list(last_plan.filters)
        chart_type = last_plan.candidate_chart_type
        warnings = list(last_plan.warnings)

        if "by year" in lowered or "show this by year" in lowered:
            dimensions = [QueryDimension(name="compliance period")]
        elif "break this down by" in lowered or "show this by" in lowered:
            dimension_text = lowered.split("by", 1)[1].strip()
            dimensions = [QueryDimension(name=dimension_text)]

        years = self.YEAR_PATTERN.findall(lowered)
        if years:
            filters = [filter_item for filter_item in filters if filter_item.field != "year"]
            filters.append(QueryFilter(field="year", operator="=", value=int(years[-1])))

        if "previous period" in lowered and years:
            target_year = int(years[-1])
            filters = [filter_item for filter_item in filters if filter_item.field != "year"]
            filters.append(
                QueryFilter(field="year", operator="in", value=[target_year - 1, target_year])
            )
        elif "previous period" in lowered and not years:
            warnings.append(
                "Interpreted 'previous period' as a comparison across adjacent years when a year column exists."
            )

        if "bar chart" in lowered:
            chart_type = "bar"
        elif "line chart" in lowered:
            chart_type = "line"
        elif "pie chart" in lowered:
            chart_type = "pie"
        elif "table" in lowered:
            chart_type = "table"

        return QueryPlan(
            question=question,
            intent=last_plan.intent,
            metrics=list(last_plan.metrics),
            dimensions=dimensions,
            filters=filters,
            timeframe=last_plan.timeframe,
            candidate_entities=last_plan.candidate_entities,
            candidate_chart_type=chart_type,
            explanation="Follow-up plan derived from prior session context and the new instruction.",
            confidence=max(last_plan.confidence - 0.05, 0.5),
            ambiguities=[],
            warnings=warnings,
            follow_up_of=session_context.last_question,
        )

    def _infer_metric(self, question: str) -> Optional[QueryMetric]:
        if any(term in question for term in ["lead time", "cycle time", "processing time"]):
            return QueryMetric(name="processing time", aggregation="avg")
        if any(term in question for term in ["count", "how many", "number of reports"]):
            return QueryMetric(name="count", aggregation="count")
        if any(term in question for term in SYNONYMS["credits"]):
            return QueryMetric(name="credits", aggregation="sum")
        if any(term in question for term in ["balance", "available balance"]):
            return QueryMetric(name="available balance", aggregation="sum")
        return None

    def _infer_dimensions(self, question: str) -> List[QueryDimension]:
        dimensions: List[QueryDimension] = []
        if " by " in question:
            dimension_text = question.split(" by ", 1)[1]
            dimension_text = re.split(r"\b(where|for|in|as)\b", dimension_text)[0].strip()
            if dimension_text:
                dimensions.append(QueryDimension(name=dimension_text))
        if not dimensions and "trend" in question:
            dimensions.append(QueryDimension(name="year"))
        return dimensions

    def _infer_filters(self, question: str) -> List[QueryFilter]:
        filters: List[QueryFilter] = []
        years = self.YEAR_PATTERN.findall(question)
        if len(years) == 1:
            filters.append(QueryFilter(field="year", operator="=", value=int(years[0])))
        elif len(years) > 1:
            filters.append(
                QueryFilter(
                    field="year",
                    operator="in",
                    value=[int(year) for year in years[:2]],
                )
            )
        return filters

    def _infer_chart_type(self, question: str):
        if any(term in question for term in ["line chart", "trend"]):
            return "line"
        if any(term in question for term in ["pie", "composition", "share"]):
            return "pie"
        if any(term in question for term in ["scatter"]):
            return "scatter"
        if any(term in question for term in ["compare", "bar chart"]):
            return "bar"
        return "table"

    def _infer_timeframe(self, filters: List[QueryFilter]) -> Optional[str]:
        for filter_item in filters:
            if filter_item.field == "year":
                return str(filter_item.value)
        return None

    def _rank_entities(self, question: str, catalog: SchemaCatalog) -> List[str]:
        scored: List[Tuple[int, str]] = []
        lowered = question.lower()
        for entity in catalog.entities:
            score = 0
            if entity.preferred_for_analytics:
                score += 3
            score += sum(2 for tag in entity.semantic_tags if tag.replace("_", " ") in lowered)
            if entity.description:
                score += sum(
                    2 for term in entity.description.lower().split() if term in lowered
                )
            for column in entity.columns:
                if column.name.lower() in lowered:
                    score += 3
                score += sum(
                    2 for tag in column.semantic_tags if tag.replace("_", " ") in lowered
                )
            if any(term in entity.name.lower() for term in lowered.split()):
                score += 2
            if score > 0:
                scored.append((score, entity.qualified_name))
        scored.sort(key=lambda item: (-item[0], item[1]))
        return [name for _, name in scored]
