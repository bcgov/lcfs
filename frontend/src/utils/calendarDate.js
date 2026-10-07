/**
 * Format a calendar date as YYYY-MM-DD without shifting it through UTC.
 *
 * A date input's value reaches the transfer handlers as a Date at local
 * midnight (yup casts 'YYYY-MM-DD' that way), so its local fields hold the
 * date the user picked. A Date at exactly UTC midnight was parsed from a bare
 * 'YYYY-MM-DD', so its UTC fields do. Strings are ISO dates already.
 * toISOString() would turn a local midnight into the previous day for anyone
 * east of UTC.
 */
export const formatCalendarDate = (value) => {
  if (!value) return value
  if (typeof value === 'string') return value.split('T')[0]

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const isUtcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  const year = isUtcMidnight ? date.getUTCFullYear() : date.getFullYear()
  const month = (isUtcMidnight ? date.getUTCMonth() : date.getMonth()) + 1
  const day = isUtcMidnight ? date.getUTCDate() : date.getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
