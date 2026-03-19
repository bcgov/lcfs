from fastapi import APIRouter, Depends, Request

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.ai_analytics.schema import (
    AiAnalyticsFollowUpRequest,
    AiAnalyticsQuestionRequest,
    AiAnalyticsRunResponse,
    QueryPlanResponse,
    SchemaCatalogRequest,
    SchemaCatalogResponse,
    SchemaEntityResponse,
)
from lcfs.web.api.ai_analytics.services import AiAnalyticsApiService
from lcfs.web.core.decorators import view_handler


router = APIRouter()


@router.post("/schema/catalog", response_model=SchemaCatalogResponse)
@view_handler([RoleEnum.GOVERNMENT])
async def get_ai_analytics_catalog(
    request: Request,
    payload: SchemaCatalogRequest,
    service: AiAnalyticsApiService = Depends(),
):
    """Return the normalized schema catalog used by the analytics assistant."""
    return await service.get_catalog(force_refresh=payload.force_refresh)


@router.post("/query/plan", response_model=QueryPlanResponse)
@view_handler([RoleEnum.GOVERNMENT])
async def plan_ai_analytics_query(
    request: Request,
    payload: AiAnalyticsQuestionRequest,
    service: AiAnalyticsApiService = Depends(),
):
    """Interpret a question into a structured analytics plan."""
    return await service.plan(question=payload.question, session_id=payload.session_id)


@router.post("/query/run", response_model=AiAnalyticsRunResponse)
@view_handler([RoleEnum.GOVERNMENT])
async def run_ai_analytics_query(
    request: Request,
    payload: AiAnalyticsQuestionRequest,
    service: AiAnalyticsApiService = Depends(),
):
    """Plan, validate, execute, and summarize a grounded analytics question."""
    return await service.run(question=payload.question, session_id=payload.session_id)


@router.post("/query/follow-up", response_model=AiAnalyticsRunResponse)
@view_handler([RoleEnum.GOVERNMENT])
async def run_ai_analytics_follow_up(
    request: Request,
    payload: AiAnalyticsFollowUpRequest,
    service: AiAnalyticsApiService = Depends(),
):
    """Apply a follow-up instruction using the stored session context."""
    return await service.run(
        question=payload.follow_up_question,
        session_id=payload.session_id,
    )


@router.get("/views", response_model=list[SchemaEntityResponse])
@view_handler([RoleEnum.GOVERNMENT])
async def list_ai_analytics_views(
    request: Request,
    service: AiAnalyticsApiService = Depends(),
):
    """List discovered analytical views and materialized views."""
    return await service.get_views()
