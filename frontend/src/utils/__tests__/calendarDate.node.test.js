import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { formatCalendarDate } from '../calendarDate'

// CI runs in UTC, where local and UTC midnight coincide and toISOString()
// looks correct. Pin zones on both sides of UTC so a regression shows.
const withTimeZone = (timeZone, run) =>
  describe(timeZone, () => {
    let original
    beforeAll(() => {
      original = process.env.TZ
      process.env.TZ = timeZone
    })
    afterAll(() => {
      process.env.TZ = original
    })
    run()
  })

describe('formatCalendarDate', () => {
  for (const timeZone of ['Europe/Paris', 'America/Vancouver']) {
    withTimeZone(timeZone, () => {
      it('keeps the picked date of a local-midnight Date', () => {
        // How yup casts the date input's '2024-01-01'
        expect(formatCalendarDate(new Date(2024, 0, 1))).toBe('2024-01-01')
      })

      it('keeps the date of a parsed YYYY-MM-DD (UTC midnight)', () => {
        expect(formatCalendarDate(new Date('2024-01-01'))).toBe('2024-01-01')
      })
    })
  }

  it('takes the date part of ISO strings', () => {
    expect(formatCalendarDate('2024-01-01')).toBe('2024-01-01')
    expect(formatCalendarDate('2024-01-01T08:00:00Z')).toBe('2024-01-01')
  })

  it('passes empty values through and rejects invalid dates', () => {
    expect(formatCalendarDate(null)).toBeNull()
    expect(formatCalendarDate(undefined)).toBeUndefined()
    expect(formatCalendarDate(new Date('not a date'))).toBeNull()
  })
})
