/**
 * Utility functions for date and quarter calculations in LCFS
 */

/**
 * Determines the current quarter based on today's date for early issuance reports.
 * 
 * Quarter schedule follows early issuance activation dates:
 * - Q1: Mar-Jun (active from Apr 1)
 * - Q2: Jul-Sep (active from Jul 1) 
 * - Q3: Oct-Dec (active from Oct 1)
 * - Q4: Jan-Feb (active from Jan 1 of following year)
 *
 * @param {string} compliancePeriod - Target year (e.g. 2025)
 * @returns {string} - Current quarter ('Q1', 'Q2', 'Q3', 'Q4')
 */
export function getCurrentQuarter(compliancePeriod) {
  const now = new Date()
  const currentMonth = now.getMonth() // 0-11
  const currentYear = now.getFullYear()
  const year = Number.parseInt(compliancePeriod, 10)
  
  // For the compliance period year
  if (currentYear === year) {
    if (currentMonth >= 2 && currentMonth <= 5) { // Mar-Jun
      return 'Q1'
    } else if (currentMonth >= 6 && currentMonth <= 8) { // Jul-Sep
      return 'Q2'
    } else if (currentMonth >= 9 && currentMonth <= 11) { // Oct-Dec
      return 'Q3'
    }
  }
  
  // For the year after compliance period (Q4 is in Jan-Feb of following year)
  if (currentYear === year + 1 && currentMonth >= 0 && currentMonth <= 1) { // Jan-Feb
    return 'Q4'
  }
  
  // Default to Q4 if we can't determine
  return 'Q4'
}

/**
 * Gets the date range for a specific quarter in early issuance reports
 *
 * @param {string} quarter - Quarter ('Q1', 'Q2', 'Q3', 'Q4')
 * @param {string} year - Compliance period year
 * @returns {object} - Object with 'from' and 'to' date strings
 */
export function getQuarterDateRange(quarter, year) {
  const ranges = {
    'Q1': { from: `${year}-01-01`, to: `${year}-03-31` },
    'Q2': { from: `${year}-01-01`, to: `${year}-06-30` },
    'Q3': { from: `${year}-01-01`, to: `${year}-09-30` },
    'Q4': { from: `${year}-01-01`, to: `${year}-12-31` }
  };
  return ranges[quarter] || ranges['Q4'];
}