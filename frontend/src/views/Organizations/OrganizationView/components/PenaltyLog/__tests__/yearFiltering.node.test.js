import { describe, it, expect } from 'vitest'

/**
 * Focused unit tests for year filtering logic in PenaltyLogManage
 * Issue #3346: Exclude future years from compliance period dropdown
 */

describe('Year Filtering - PenaltyLogManage', () => {
  // This is the exact logic from PenaltyLogManage.jsx lines 88-109
  const filterCompliancePeriods = (compliancePeriods, currentYear) => {
    if (!compliancePeriods) return []

    return compliancePeriods
      .filter((period) => {
        const description = period.description || ''
        // Extract year from description (e.g., "2024" from "2024 Compliance Period")
        const yearMatch = description.match(/(\d{4})/)
        if (yearMatch) {
          const year = parseInt(yearMatch[1], 10)
          return year <= currentYear
        }
        // If we can't extract a year, include it to be safe
        return true
      })
      .map((period) => ({
        value: period.compliancePeriodId ?? period.compliance_period_id,
        label: period.description
      }))
  }

  it('should return empty array when compliancePeriods is null', () => {
    const result = filterCompliancePeriods(null, 2024)
    expect(result).toEqual([])
  })

  it('should return empty array when compliancePeriods is undefined', () => {
    const result = filterCompliancePeriods(undefined, 2024)
    expect(result).toEqual([])
  })

  it('should filter out future years', () => {
    const periods = [
      { compliancePeriodId: 1, description: '2023 Compliance Period' },
      { compliancePeriodId: 2, description: '2024 Compliance Period' },
      { compliancePeriodId: 3, description: '2025 Compliance Period' }
    ]

    const result = filterCompliancePeriods(periods, 2024)

    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('2023 Compliance Period')
    expect(result[1].label).toBe('2024 Compliance Period')
  })

  it('should include current year', () => {
    const periods = [
      { compliancePeriodId: 1, description: '2024 Compliance Period' }
    ]

    const result = filterCompliancePeriods(periods, 2024)

    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('2024 Compliance Period')
  })

  it('should include past years', () => {
    const periods = [
      { compliancePeriodId: 1, description: '2020 Compliance Period' },
      { compliancePeriodId: 2, description: '2021 Compliance Period' },
      { compliancePeriodId: 3, description: '2022 Compliance Period' }
    ]

    const result = filterCompliancePeriods(periods, 2024)

    expect(result).toHaveLength(3)
  })

  it('should handle periods with no year in description (fail-safe)', () => {
    const periods = [
      { compliancePeriodId: 1, description: '2024 Compliance Period' },
      { compliancePeriodId: 99, description: 'Special Period' }
    ]

    const result = filterCompliancePeriods(periods, 2024)

    // Both should be included - one matches current year, one has no year (fail-safe)
    expect(result).toHaveLength(2)
    expect(result[1].label).toBe('Special Period')
  })

  it('should extract year correctly from various formats', () => {
    const periods = [
      { compliancePeriodId: 1, description: '2023 Compliance Period' },
      { compliancePeriodId: 2, description: 'Compliance Period 2024' },
      { compliancePeriodId: 3, description: '2025' },
      { compliancePeriodId: 4, description: 'Period for 2026' }
    ]

    const result = filterCompliancePeriods(periods, 2024)

    expect(result).toHaveLength(2)
    expect(result[0].label).toContain('2023')
    expect(result[1].label).toContain('2024')
  })

  it('should map to correct output format', () => {
    const periods = [
      { compliancePeriodId: 1, description: '2024 Compliance Period' }
    ]

    const result = filterCompliancePeriods(periods, 2024)

    expect(result[0]).toHaveProperty('value')
    expect(result[0]).toHaveProperty('label')
    expect(result[0].value).toBe(1)
    expect(result[0].label).toBe('2024 Compliance Period')
  })

  it('should handle compliance_period_id as fallback', () => {
    const periods = [
      { compliance_period_id: 5, description: '2024 Compliance Period' }
    ]

    const result = filterCompliancePeriods(periods, 2024)

    expect(result[0].value).toBe(5)
  })

  it('should filter complex scenario', () => {
    const periods = [
      { compliancePeriodId: 1, description: '2020 Compliance Period' },
      { compliancePeriodId: 2, description: '2021 Compliance Period' },
      { compliancePeriodId: 3, description: '2022 Compliance Period' },
      { compliancePeriodId: 4, description: '2023 Compliance Period' },
      { compliancePeriodId: 5, description: '2024 Compliance Period' },
      { compliancePeriodId: 6, description: '2025 Compliance Period' },
      { compliancePeriodId: 7, description: '2026 Compliance Period' },
      { compliancePeriodId: 8, description: '2027 Compliance Period' }
    ]

    const result = filterCompliancePeriods(periods, 2024)

    expect(result).toHaveLength(5) // 2020-2024
    expect(result.every(r => {
      const year = parseInt(r.label.match(/(\d{4})/)[1], 10)
      return year <= 2024
    })).toBe(true)
  })
})
