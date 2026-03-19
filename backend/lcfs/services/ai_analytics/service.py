from __future__ import annotations

from typing import List, Optional

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.services.ai_analytics.chart_builder import ChartBuilder, ResultAnalyzer
from lcfs.services.ai_analytics.llm_client import build_local_llm_client
from lcfs.services.ai_analytics.prompts import ANALYSIS_PROMPT, PLANNING_PROMPT
from lcfs.services.ai_analytics.providers.base import StructuredLlmError
from lcfs.services.ai_analytics.query_executor import QueryExecutor
from lcfs.services.ai_analytics.query_planner import QueryPlanner
from lcfs.services.ai_analytics.schema_catalog import SchemaCatalogService
from lcfs.services.ai_analytics.session_memory import SessionMemoryStore
from lcfs.services.ai_analytics.sql_generator import SqlGenerator
from lcfs.services.ai_analytics.sql_validator import SqlSafetyValidator
from lcfs.services.ai_analytics.types import (
    AssistantResponse,
    LlmAnalysisPayload,
    LlmPlanPayload,
    QueryPlan,
    SchemaCatalog,
    SchemaEntity,
    SessionContext,
)
from lcfs.settings import settings


logger = structlog.get_logger(__name__)


class AiAnalyticsService:
    """Orchestrates cataloging, planning, SQL generation, execution, and summarization."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.catalog_service = SchemaCatalogService(db)
        self.planner = QueryPlanner()
        self.sql_generator = SqlGenerator()
        self.sql_validator = SqlSafetyValidator()
        self.executor = QueryExecutor(db)
        self.chart_builder = ChartBuilder()
        self.result_analyzer = ResultAnalyzer()
        self.memory = SessionMemoryStore()
        self.execution_mode = settings.ai_analytics_mode
        self.local_llm_client = None
        if self.execution_mode != "heuristic_only":
            self.local_llm_client = build_local_llm_client(settings)

    async def get_catalog(self, force_refresh: bool = False) -> SchemaCatalog:
        return await self.catalog_service.get_catalog(force_refresh=force_refresh)

    async def get_views(self) -> List[SchemaEntity]:
        catalog = await self.get_catalog()
        return [
            entity
            for entity in catalog.entities
            if entity.entity_type in {"view", "materialized_view"}
        ]

    async def plan(self, question: str, session_id: str) -> QueryPlan:
        catalog = await self.get_catalog()
        session_context = self.memory.get(session_id)
        return await self._build_plan(question, catalog, session_context)

    async def run(self, question: str, session_id: str) -> AssistantResponse:
        catalog = await self.get_catalog()
        session_context = self.memory.get(session_id)
        plan = await self._build_plan(question, catalog, session_context)
        generated_sql = self.sql_generator.generate(plan, catalog)
        self.sql_validator.validate(generated_sql, catalog)
        logger.info(
            "ai_analytics_query_generated",
            session_id=session_id,
            question=question,
            entity=generated_sql.entity_name,
            sql=generated_sql.sql,
            mode=self.execution_mode,
            provider=self.provider_name,
            model=self.model_name,
        )
        result = await self.executor.execute(generated_sql)
        analysis = self.result_analyzer.analyze(plan, result)
        analysis = await self._enhance_analysis_with_llm(
            analysis=analysis,
            plan=plan,
            result=result,
            entities_used=[
                entity
                for entity in catalog.entities
                if entity.qualified_name == generated_sql.entity_name
            ],
        )
        chart = self.chart_builder.build(plan, result)
        entities_used = [
            entity
            for entity in catalog.entities
            if entity.qualified_name == generated_sql.entity_name
        ]

        self.memory.upsert(
            SessionContext(
                session_id=session_id,
                last_question=question,
                last_plan=plan,
                last_sql=generated_sql.sql,
                last_chart_type=chart.chart_type,
                last_entity_names=[entity.qualified_name for entity in entities_used],
            )
        )

        return AssistantResponse(
            session_id=session_id,
            execution_mode=self.execution_mode,
            llm_provider=self.provider_name,
            model_name=self.model_name,
            summary=analysis.summary,
            sql=generated_sql.sql,
            query_plan=plan,
            result=result,
            chart=chart,
            entities_used=entities_used,
            warnings=generated_sql.warnings,
            assumptions=generated_sql.assumptions,
            key_findings=analysis.key_findings,
            caveats=analysis.caveats,
        )

    @property
    def provider_name(self) -> Optional[str]:
        if self.local_llm_client is None:
            return None
        return self.local_llm_client.provider_name

    @property
    def model_name(self) -> Optional[str]:
        if self.local_llm_client is None:
            return None
        return self.local_llm_client.model_name

    async def _build_plan(
        self,
        question: str,
        catalog: SchemaCatalog,
        session_context: Optional[SessionContext],
    ) -> QueryPlan:
        heuristic_plan = self.planner.create_plan(question, catalog, session_context)
        heuristic_plan.execution_mode = self.execution_mode
        heuristic_plan.llm_provider = self.provider_name
        heuristic_plan.model_name = self.model_name
        if self.local_llm_client is None:
            return heuristic_plan
        prompt = self._build_planning_prompt(question, catalog, session_context)
        if settings.ai_analytics_log_prompts:
            logger.info(
                "ai_analytics_planning_prompt",
                mode=self.execution_mode,
                provider=self.provider_name,
                model=self.model_name,
                prompt=prompt,
            )
        try:
            llm_plan = await self.local_llm_client.generate_json(prompt, LlmPlanPayload)
            merged = self.planner.merge_llm_plan(heuristic_plan, llm_plan, catalog)
            merged.execution_mode = self.execution_mode
            merged.llm_provider = self.provider_name
            merged.model_name = self.model_name
            return merged
        except StructuredLlmError as exc:
            logger.warning(
                "ai_analytics_plan_fallback_to_heuristic",
                error=str(exc),
                mode=self.execution_mode,
                provider=self.provider_name,
                model=self.model_name,
            )
            heuristic_plan.warnings.append(
                "Local model planning failed, so heuristic planning was used."
            )
            return heuristic_plan

    async def _enhance_analysis_with_llm(
        self,
        analysis,
        plan: QueryPlan,
        result,
        entities_used: list[SchemaEntity],
    ):
        if (
            self.local_llm_client is None
            or not settings.ai_analytics_enable_llm_summary
        ):
            return analysis
        prompt = self._build_analysis_prompt(plan, result, entities_used)
        if settings.ai_analytics_log_prompts:
            logger.info(
                "ai_analytics_analysis_prompt",
                mode=self.execution_mode,
                provider=self.provider_name,
                model=self.model_name,
                prompt=prompt,
            )
        try:
            llm_analysis = await self.local_llm_client.generate_json(
                prompt, LlmAnalysisPayload
            )
            analysis.summary = llm_analysis.summary
            analysis.key_findings = llm_analysis.findings or analysis.key_findings
            analysis.caveats = llm_analysis.caveats or analysis.caveats
            analysis.title = llm_analysis.suggested_title or analysis.title
            return analysis
        except StructuredLlmError as exc:
            logger.warning(
                "ai_analytics_summary_fallback_to_heuristic",
                error=str(exc),
                mode=self.execution_mode,
                provider=self.provider_name,
                model=self.model_name,
            )
            return analysis

    def _build_planning_prompt(
        self,
        question: str,
        catalog: SchemaCatalog,
        session_context: Optional[SessionContext],
    ) -> str:
        entity_lines = []
        for entity in catalog.entities[:30]:
            entity_lines.append(
                f"- {entity.qualified_name} [{entity.entity_type}] "
                f"tags={','.join(entity.semantic_tags[:5])} "
                f"columns={','.join(column.name for column in entity.columns[:12])}"
            )
        session_summary = ""
        if session_context and session_context.last_plan:
            session_summary = (
                f"Previous question: {session_context.last_question}\n"
                f"Previous entities: {', '.join(session_context.last_entity_names)}\n"
            )
        return (
            f"{PLANNING_PROMPT.strip()}\n\n"
            f"Question:\n{question}\n\n"
            f"Session:\n{session_summary or 'None'}\n"
            f"Schema catalog excerpt:\n" + "\n".join(entity_lines)
        )

    def _build_analysis_prompt(self, plan: QueryPlan, result, entities_used: list[SchemaEntity]) -> str:
        entity_lines = [
            f"- {entity.qualified_name}: {entity.description or 'No description'}"
            for entity in entities_used
        ]
        return (
            f"{ANALYSIS_PROMPT.strip()}\n\n"
            f"Question:\n{plan.question}\n\n"
            f"Plan:\nintent={plan.intent}; chart={plan.candidate_chart_type}; "
            f"metrics={[metric.name for metric in plan.metrics]}; "
            f"dimensions={[dimension.name for dimension in plan.dimensions]}\n\n"
            f"Entities used:\n" + "\n".join(entity_lines) + "\n\n"
            f"Columns: {result.columns}\n"
            f"Rows sample: {result.sample_preview[:10]}"
        )
