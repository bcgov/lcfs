/**
 * Determines if a quarter is editable based on whether
 * today's date is on or after the quarter's 'activation date'
 * for a given compliance year.
 *
 * - Q1: active on Apr 1 (year)
 * - Q2: active on Jul 1 (year)
 * - Q3: active on Oct 1 (year)
 * - Q4: active on Jan 1 (year + 1)
 *
 * @param {number} quarter - Quarter (1..4)
 * @param {string} compliancePeriod - Target year (e.g. 2025)
 * @returns {boolean} - Whether editing should be enabled for that quarter
 */
export function isQuarterEditable(quarter, compliancePeriod) {
  const now = new Date()

  const year = Number.parseInt(compliancePeriod, 10)

  let activationDate
  switch (quarter) {
    case 1:
      activationDate = new Date(year, 3, 1) // month is 0-based, so 3 -> April
      break
    case 2:
      activationDate = new Date(year, 6, 1) // 6 -> July
      break
    case 3:
      activationDate = new Date(year, 9, 1) // 9 -> October
      break
    case 4:
      activationDate = new Date(year + 1, 0, 1) // 0 -> January, +1 year
      break
    default:
      return false
  }

  return now >= activationDate
}
