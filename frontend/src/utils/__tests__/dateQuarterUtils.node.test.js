import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCurrentQuarter, getQuarterDateRange } from '../dateQuarterUtils'

const setDate = (dateStr) => {
  vi.setSystemTime(new Date(dateStr))
}

describe('dateQuarterUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns Q1 for dates between Mar and Jun of same year', () => {
    setDate('2025-04-15')
    expect(getCurrentQuarter('2025')).toBe('Q1')
  })

  it('returns Q2 for dates between Jul and Sep of same year', () => {
    setDate('2025-08-10')
    expect(getCurrentQuarter('2025')).toBe('Q2')
  })

  it('returns Q3 for dates between Oct and Dec of same year', () => {
    setDate('2025-11-01')
    expect(getCurrentQuarter('2025')).toBe('Q3')
  })

  it('returns Q4 for Jan-Feb of following year', () => {
    setDate('2026-01-20')
    expect(getCurrentQuarter('2025')).toBe('Q4')
  })

  it('defaults to Q4 when outside defined ranges', () => {
    // For example Feb of compliance year (not yet active) should fallback to Q4
    setDate('2025-02-15')
    expect(getCurrentQuarter('2025')).toBe('Q4')
  })

  it('getQuarterDateRange returns correct ranges', () => {
    expect(getQuarterDateRange('Q1', '2025')).toEqual({
      from: '2025-01-01',
      to: '2025-03-31'
    })
    expect(getQuarterDateRange('Q2', '2025')).toEqual({
      from: '2025-01-01',
      to: '2025-06-30'
    })
    expect(getQuarterDateRange('Q3', '2025')).toEqual({
      from: '2025-01-01',
      to: '2025-09-30'
    })
    expect(getQuarterDateRange('Q4', '2025')).toEqual({
      from: '2025-01-01',
      to: '2025-12-31'
    })
    // Default path unknown quarter -> Q4 range
    expect(getQuarterDateRange('Unknown', '2025')).toEqual({
      from: '2025-01-01',
      to: '2025-12-31'
    })
  })
})
