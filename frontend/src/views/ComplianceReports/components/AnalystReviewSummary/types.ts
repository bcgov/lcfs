export type ReviewSeverity = 'concern' | 'review' | 'informational'
export type ReviewSectionStatus = 'clear' | 'review' | 'concern'

export interface RobotVariant {
  name: string
  color: string
  background: string
}

export interface ReviewMetric {
  label: string
  value?: string | number | null
  comparisonValue?: string | number | null
  delta?: string | number | null
  percentChange?: string | number | null
  units?: string | null
}

export interface ReviewFinding {
  reviewArea: string
  severity: ReviewSeverity
  title: string
  detail: string
  source: string
  evidence?: ReviewMetric[]
  suggestedFollowUp?: string | null
  confidence: string
}

export interface ReviewSection {
  section: string
  status: ReviewSectionStatus
  findings: ReviewFinding[]
}

export interface ComparisonPoint {
  label: string
  currentValue: number
  comparisonValue: number
  delta: number
  percentChange?: number | null
  units?: string | null
}

export interface ComparisonSeries {
  title: string
  currentLabel: string
  comparisonLabel: string
  points: ComparisonPoint[]
}

export interface ComplianceUnitPoint {
  fuelType: string
  schedule: string
  complianceUnits: number
}

export interface ReviewChartData {
  historicalVariance?: ComparisonSeries[]
  supplementalImpact?: ComparisonSeries[]
  complianceUnitsByFuel?: ComplianceUnitPoint[]
}

export interface ReviewSummaryData {
  summary: string
  sections?: ReviewSection[]
  topFollowUpQuestions?: string[]
  chartData?: ReviewChartData
}
