import type { ReviewFinding, ReviewMetric } from './types'

export const formatMetric = (metric: ReviewMetric) => {
  const parts = [`${metric.label}: ${metric.value ?? 'n/a'}`]
  if (metric.comparisonValue !== null && metric.comparisonValue !== undefined) {
    parts.push(`comparison ${metric.comparisonValue}`)
  }
  if (metric.delta !== null && metric.delta !== undefined) {
    parts.push(`delta ${metric.delta}`)
  }
  if (metric.percentChange !== null && metric.percentChange !== undefined) {
    parts.push(`${metric.percentChange}%`)
  }
  if (metric.units) {
    parts.push(metric.units)
  }
  return parts.join(' | ')
}

export const getAddressedStorageKey = (complianceReportId: string | number) =>
  `analyst-review-addressed-${complianceReportId}`

export const getFindingId = (
  sectionName: string,
  finding: ReviewFinding,
  index: number
) =>
  [sectionName, finding.severity, finding.source, finding.title, index].join(
    '|'
  )

export const isActionableFinding = (finding: ReviewFinding) =>
  finding.severity === 'concern' || finding.severity === 'review'

export const uniqueQuestions = (questions: string[] = []) => {
  const seen = new Set()
  return questions.filter((question) => {
    const normalizedQuestion = question
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
    if (seen.has(normalizedQuestion)) {
      return false
    }
    seen.add(normalizedQuestion)
    return true
  })
}
