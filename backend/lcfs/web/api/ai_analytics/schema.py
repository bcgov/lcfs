from lcfs.services.ai_analytics.types import (
    AssistantResponse,
    QueryPlan,
    SchemaCatalog,
    SchemaEntity,
)
from lcfs.web.api.base import BaseSchema


class AiAnalyticsQuestionRequest(BaseSchema):
    question: str
    session_id: str


class AiAnalyticsFollowUpRequest(BaseSchema):
    follow_up_question: str
    session_id: str


class SchemaCatalogRequest(BaseSchema):
    force_refresh: bool = False


SchemaCatalogResponse = SchemaCatalog
QueryPlanResponse = QueryPlan
AiAnalyticsRunResponse = AssistantResponse
SchemaEntityResponse = SchemaEntity
