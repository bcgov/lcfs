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

  it('handles Q4 activation in the next calendar year', () => {
    // Activation date for Q4 2024 is Jan 1 2025
    setDate('2025-01-02T00:00:00Z')
    expect(isQuarterEditable(4, '2024')).toBe(true)
  })

  it('returns false for invalid quarter values', () => {
    setDate('2025-01-01T00:00:00Z')
    expect(isQuarterEditable(5, '2024')).toBe(false)
    expect(isQuarterEditable(0, '2024')).toBe(false)
  })
})
