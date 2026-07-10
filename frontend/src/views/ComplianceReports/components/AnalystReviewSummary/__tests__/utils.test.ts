import { describe, expect, it } from 'vitest'
import { formatMetric, uniqueQuestions } from '../utils'

describe('AnalystReviewSummary utils', () => {
  it('formats metric comparison details', () => {
    expect(
      formatMetric({
        label: 'Total kWh',
        value: 1200,
        comparisonValue: 1000,
        delta: 200,
        percentChange: 20,
        units: 'kWh'
      })
    ).toBe('Total kWh: 1200 | comparison 1000 | delta 200 | 20% | kWh')
  })

  it('deduplicates follow-up questions ignoring case and spacing', () => {
    expect(
      uniqueQuestions([
        'Why did usage increase?',
        ' why   did usage increase? ',
        'Does line 20 reconcile?'
      ])
    ).toEqual(['Why did usage increase?', 'Does line 20 reconcile?'])
  })
})
