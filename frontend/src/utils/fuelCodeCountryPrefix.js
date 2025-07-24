/**
 * Utility functions for handling country-based fuel code prefixes
 * Applies to 2025 compliance reports and forward
 */

// Country prefix mapping
const COUNTRY_PREFIXES = {
  canada: 'C-'
}

/**
 * Gets the country prefix for a given country name
 * @param {string} country - The country name (case insensitive)
 * @returns {string} The prefix to apply, or empty string if no prefix needed
 */
export const getCountryPrefix = (country) => {
  if (!country) return ''

  const normalizedCountry = country.toLowerCase().trim()
  return COUNTRY_PREFIXES[normalizedCountry] || ''
}

/**
 * Formats a fuel code with country prefix for display
 * Only applies to 2025 compliance periods and forward
 * @param {string} fuelCode - The fuel code to format
 * @param {string} country - The production facility country
 * @param {number|string} compliancePeriod - The compliance period (e.g., 2025)
 * @returns {string} The formatted fuel code with prefix if applicable
 */
export const formatFuelCodeWithCountryPrefix = (
  fuelCode,
  country,
  compliancePeriod
) => {
  if (!fuelCode) return fuelCode

  // Only apply to 2025 reports and forward
  const periodYear = parseInt(compliancePeriod, 10)
  if (isNaN(periodYear) || periodYear < 2025) {
    return fuelCode
  }

  const prefix = getCountryPrefix(country)
  return prefix ? `${prefix}${fuelCode}` : fuelCode
}

/**
 * Extracts the original fuel code from a formatted fuel code with prefix
 * @param {string} formattedFuelCode - The fuel code that may contain a country prefix
 * @returns {string} The original fuel code without prefix
 */
export const extractOriginalFuelCode = (formattedFuelCode) => {
  if (!formattedFuelCode) return formattedFuelCode

  // Check each prefix and remove if found
  for (const prefix of Object.values(COUNTRY_PREFIXES)) {
    if (formattedFuelCode.startsWith(prefix)) {
      return formattedFuelCode.substring(prefix.length)
    }
  }

  return formattedFuelCode
}

/**
 * Formats fuel code options for dropdown display
 * @param {Array} fuelCodes - Array of fuel code objects with fuelCode/fuel_code and fuelProductionFacilityCountry/fuel_production_facility_country
 * @param {number|string} compliancePeriod - The compliance period
 * @returns {Array} Array of formatted fuel code strings for display
 */
export const formatFuelCodeOptions = (fuelCodes, compliancePeriod) => {
  if (!fuelCodes || !Array.isArray(fuelCodes)) return []

  return fuelCodes.map((item) => {
    // Handle both snake_case and camelCase field names
    const country =
      item.fuelProductionFacilityCountry ||
      item.fuel_production_facility_country
    const fuelCode = item.fuelCode || item.fuel_code
    return formatFuelCodeWithCountryPrefix(fuelCode, country, compliancePeriod)
  })
}
