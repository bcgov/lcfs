import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isQuarterEditable } from '../cellEditables'

// Helper to set system time easily
const setDate = (dateStr) => {
  vi.setSystemTime(new Date(dateStr))
}

describe('isQuarterEditable', () => {
  beforeEach(() => {
    // use fake timers so vi.setSystemTime works reliably
    vi.useFakeTimers()
  })

  afterEach(() => {
    // Restore the real timers and system time
    vi.useRealTimers()
  })

  it('returns false before activation date for Q1', () => {
    setDate('2024-02-01T00:00:00Z') // Feb 1 2024 – before Apr 1
    expect(isQuarterEditable(1, '2024')).toBe(false)
  })

  it('returns true on/after activation date for Q1', () => {
    setDate('2024-04-02T00:00:00Z') // Apr 2 2024 – after Apr 1
    expect(isQuarterEditable(1, '2024')).toBe(true)
  })

  it('returns true on the exact Q1 activation date', () => {
    vi.setSystemTime(new Date(2024, 3, 1)) // Apr 1 local
    expect(isQuarterEditable(1, 2024)).toBe(true)
  })

  it('returns false before Q2 activation and true after Jul 1', () => {
    vi.setSystemTime(new Date(2024, 5, 30, 23, 59, 59)) // Jun 30
    expect(isQuarterEditable(2, '2024')).toBe(false)
    vi.setSystemTime(new Date(2024, 6, 1)) // Jul 1
    expect(isQuarterEditable(2, 2024)).toBe(true)
  })

  it('returns false before Q3 activation and true after Oct 1', () => {
    vi.setSystemTime(new Date(2024, 8, 30)) // Sep 30
    expect(isQuarterEditable(3, '2024')).toBe(false)
    vi.setSystemTime(new Date(2024, 9, 1)) // Oct 1
    expect(isQuarterEditable(3, 2024)).toBe(true)
  })

  it('handles Q4 activation in the next calendar year', () => {
    // Activation date for Q4 2024 is Jan 1 2025
    setDate('2025-01-02T00:00:00Z')
    expect(isQuarterEditable(4, '2024')).toBe(true)
  })

  it('returns false for Q4 before January of the following year', () => {
    vi.setSystemTime(new Date(2024, 11, 31, 23, 59, 59))
    expect(isQuarterEditable(4, 2024)).toBe(false)
  })

  it('accepts a numeric compliance period', () => {
    vi.setSystemTime(new Date(2024, 6, 2))
    expect(isQuarterEditable(2, 2024)).toBe(true)
  })

  it('returns false for invalid quarter values', () => {
    setDate('2025-01-01T00:00:00Z')
    expect(isQuarterEditable(5, '2024')).toBe(false)
    expect(isQuarterEditable(0, '2024')).toBe(false)
    expect(isQuarterEditable(-1, '2024')).toBe(false)
  })
})
