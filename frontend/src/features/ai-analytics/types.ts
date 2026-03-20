export type ChartType =
  | 'line'
  | 'bar'
  | 'stacked_bar'
  | 'pie'
  | 'scatter'
  | 'table'

export interface SchemaColumn {
  name: string
  dataType: string
  nullable: boolean
  primaryKey: boolean
  foreignKeyTarget?: string | null
  description?: string | null
  semanticTags: string[]
}

export interface SchemaRelationship {
  sourceEntity: string
  sourceColumn: string
  targetEntity: string
  targetColumn: string
  relationshipType: string
}

export interface SchemaEntity {
  name: string
  schemaName: string
  entityType: 'table' | 'view' | 'materialized_view'
  description?: string | null
  columns: SchemaColumn[]
  relationships: SchemaRelationship[]
  semanticTags: string[]
  preferredForAnalytics: boolean
}

export interface SchemaCatalog {
  entities: SchemaEntity[]
  generatedAt: string
  semanticRegistry: Record<string, string[]>
}

export interface QueryMetric {
  name: string
  aggregation: string
  resolvedColumn?: string | null
}

export interface QueryDimension {
  name: string
  resolvedColumn?: string | null
}

export interface QueryFilter {
  field: string
  operator: string
  value: string | number | number[]
  resolvedColumn?: string | null
}

export interface QueryPlan {
  question: string
  executionMode?: 'heuristic_only' | 'local_llm_direct' | 'openclaw_local' | null
  llmProvider?: string | null
  modelName?: string | null
  intent: string
  metrics: QueryMetric[]
  dimensions: QueryDimension[]
  filters: QueryFilter[]
  timeframe?: string | null
  candidateEntities: string[]
  candidateChartType: ChartType
  explanation: string
  confidence: number
  ambiguities: string[]
  warnings: string[]
  followUpOf?: string | null
}

export interface QueryResult {
  columns: string[]
  columnTypes: Record<string, string>
  rows: Array<Record<string, unknown>>
  rowCount: number
  executionMs: number
  samplePreview: Array<Record<string, unknown>>
}

export interface ChartSpec {
  chartType: ChartType
  title: string
  option: Record<string, unknown>
  rationale: string
}

export interface AssistantResponse {
  sessionId: string
  executionMode: 'heuristic_only' | 'local_llm_direct' | 'openclaw_local'
  llmProvider?: string | null
  modelName?: string | null
  forecastMode?: boolean
  mindsdbModelName?: string | null
  forecastHorizon?: number | null
  forecastGranularity?: string | null
  sourceEntityUsed?: string | null
  sourceSqlUsed?: string | null
  historicalRows?: Array<Record<string, unknown>>
  forecastRows?: Array<Record<string, unknown>>
  combinedSeries?: Array<Record<string, unknown>>
  modelReused?: boolean | null
  summary: string
  sql: string
  queryPlan: QueryPlan
  result: QueryResult
  chart: ChartSpec
  entitiesUsed: SchemaEntity[]
  warnings: string[]
  assumptions: string[]
  keyFindings: string[]
  caveats: string[]
}
