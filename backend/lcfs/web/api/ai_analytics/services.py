from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.services.ai_analytics.service import (
    AiAnalyticsService as CoreAiAnalyticsService,
)
from lcfs.services.ai_analytics.types import (
    AssistantResponse,
    QueryPlan,
    SchemaCatalog,
    SchemaEntity,
)
from lcfs.web.core.decorators import service_handler


class AiAnalyticsApiService:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.service = CoreAiAnalyticsService(db)

    @service_handler
    async def get_catalog(self, force_refresh: bool = False) -> SchemaCatalog:
        return await self.service.get_catalog(force_refresh=force_refresh)

    @service_handler
    async def get_views(self) -> list[SchemaEntity]:
        return await self.service.get_views()

    @service_handler
    async def plan(self, question: str, session_id: str) -> QueryPlan:
        return await self.service.plan(question=question, session_id=session_id)

    @service_handler
    async def run(self, question: str, session_id: str) -> AssistantResponse:
        return await self.service.run(question=question, session_id=session_id)
