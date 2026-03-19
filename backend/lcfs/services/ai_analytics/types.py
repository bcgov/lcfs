from typing import Any, Dict, List, Literal, Optional

from pydantic import Field

from lcfs.web.api.base import BaseSchema


EntityType = Literal["table", "view", "materialized_view"]
ChartType = Literal["line", "bar", "stacked_bar", "pie", "scatter", "table"]
ExecutionMode = Literal["heuristic_only", "local_llm_direct", "openclaw_local"]


class SchemaColumn(BaseSchema):
    name: str
    data_type: str
    nullable: bool = True
    primary_key: bool = False
    foreign_key_target: Optional[str] = None
    description: Optional[str] = None
    semantic_tags: List[str] = Field(default_factory=list)


class SchemaRelationship(BaseSchema):
    source_entity: str
    source_column: str
    target_entity: str
    target_column: str
    relationship_type: str = "many_to_one"


class SchemaEntity(BaseSchema):
    name: str
    schema_name: str
    entity_type: EntityType
    description: Optional[str] = None
    columns: List[SchemaColumn] = Field(default_factory=list)
    relationships: List[SchemaRelationship] = Field(default_factory=list)
    semantic_tags: List[str] = Field(default_factory=list)
    preferred_for_analytics: bool = False
    view_sql: Optional[str] = None

    @property
    def qualified_name(self) -> str:
        return f"{self.schema_name}.{self.name}"


class SchemaCatalog(BaseSchema):
    entities: List[SchemaEntity]
    generated_at: str
    semantic_registry: Dict[str, List[str]] = Field(default_factory=dict)


class QueryMetric(BaseSchema):
    name: str
    aggregation: str = "sum"
    resolved_column: Optional[str] = None


class QueryDimension(BaseSchema):
    name: str
    resolved_column: Optional[str] = None


class QueryFilter(BaseSchema):
    field: str
    operator: str
    value: Any
    resolved_column: Optional[str] = None


class QueryPlan(BaseSchema):
    question: str
    execution_mode: Optional[ExecutionMode] = None
    llm_provider: Optional[str] = None
    model_name: Optional[str] = None
    intent: str
    metrics: List[QueryMetric] = Field(default_factory=list)
    dimensions: List[QueryDimension] = Field(default_factory=list)
    filters: List[QueryFilter] = Field(default_factory=list)
    timeframe: Optional[str] = None
    candidate_entities: List[str] = Field(default_factory=list)
    candidate_chart_type: ChartType = "table"
    explanation: str
    confidence: float = 0.0
    ambiguities: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    follow_up_of: Optional[str] = None


class GeneratedSql(BaseSchema):
    sql: str
    entity_name: str
    entity_type: EntityType
    used_columns: List[str] = Field(default_factory=list)
    applied_limit: Optional[int] = None
    chart_type: ChartType = "table"
    warnings: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)


class QueryExecutionResult(BaseSchema):
    columns: List[str]
    column_types: Dict[str, str]
    rows: List[Dict[str, Any]]
    row_count: int
    execution_ms: float
    sample_preview: List[Dict[str, Any]] = Field(default_factory=list)


class ChartSpec(BaseSchema):
    chart_type: ChartType
    title: str
    option: Dict[str, Any]
    rationale: str


class AnalysisOutput(BaseSchema):
    summary: str
    key_findings: List[str] = Field(default_factory=list)
    caveats: List[str] = Field(default_factory=list)
    title: str


class AssistantResponse(BaseSchema):
    session_id: str
    execution_mode: ExecutionMode
    llm_provider: Optional[str] = None
    model_name: Optional[str] = None
    summary: str
    sql: str
    query_plan: QueryPlan
    result: QueryExecutionResult
    chart: ChartSpec
    entities_used: List[SchemaEntity]
    warnings: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    key_findings: List[str] = Field(default_factory=list)
    caveats: List[str] = Field(default_factory=list)


class SessionContext(BaseSchema):
    session_id: str
    last_question: Optional[str] = None
    last_plan: Optional[QueryPlan] = None
    last_sql: Optional[str] = None
    last_chart_type: Optional[ChartType] = None
    last_entity_names: List[str] = Field(default_factory=list)


class LlmPlanPayload(BaseSchema):
    intent: str
    metrics: List[str] = Field(default_factory=list)
    dimensions: List[str] = Field(default_factory=list)
    filters: List[Dict[str, Any]] = Field(default_factory=list)
    timeframe: Optional[str] = None
    entities: List[str] = Field(default_factory=list)
    chart_type: ChartType = "table"
    explanation: str
    confidence: float = 0.0
    ambiguities: List[str] = Field(default_factory=list)


class LlmAnalysisPayload(BaseSchema):
    summary: str
    findings: List[str] = Field(default_factory=list)
    caveats: List[str] = Field(default_factory=list)
    suggested_title: str
    suggested_subtitle: Optional[str] = None
