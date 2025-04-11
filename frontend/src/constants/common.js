import { roles } from '@/constants/roles'

export const KEY_LEFT = 'ArrowLeft'
export const KEY_UP = 'ArrowUp'
export const KEY_RIGHT = 'ArrowRight'
export const KEY_DOWN = 'ArrowDown'
export const KEY_ENTER = 'Enter'
export const KEY_TAB = 'Tab'
export const KEY_PAGE_UP = 'PageUp'
export const KEY_PAGE_DOWN = 'PageDown'
export const KEY_PAGE_HOME = 'Home'
export const KEY_PAGE_END = 'End'
export const KEY_PERIOD = '.'

// badge sizes for various user roles:
export const ROLES_BADGE_SIZE = {
  [roles.transfers]: 78,
  [roles.signing_authority]: 140,
  [roles.compliance_reporting]: 172,
  [roles.manage_users]: 119,
  [roles.read_only]: 91,
  [roles.administrator]: 115,
  [roles.compliance_manager]: 166,
  [roles.analyst]: 71,
  [roles.director]: 77,
  [roles.supplier]: 0,
  [roles.government]: 0
}

export const SUMMARY = {
  LINE_1: 0,
  LINE_2: 1,
  LINE_3: 2,
  LINE_4: 3,
  LINE_5: 4,
  LINE_6: 5,
  LINE_7: 6,
  LINE_8: 7,
  LINE_9: 8,
  LINE_10: 9,
  LINE_11: 10,
  LINE_12: 11,
  LINE_13: 12,
  LINE_14: 13,
  LINE_15: 14,
  LINE_16: 15,
  LINE_17: 16,
  LINE_18: 17,
  LINE_19: 18,
  LINE_20: 19,
  LINE_21: 20,
  LINE_22: 21
}

export const DEFAULT_CI_FUEL = {
  Gasoline: 93.67,
  Diesel: 100.21,
  'Jet fuel': 88.83
}

export const PHONE_REGEX =
  /^((\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})?$/

export const HELP_GUIDE_URL =
  'https://www2.gov.bc.ca/gov/content?id=7A58AF3855154747A0793F0C9A6E9089'
export const ADDRESS_SEARCH_URL =
  'https://geocoder.api.gov.bc.ca/addresses.json?minScore=50&maxResults=5&echo=true&brief=true&autoComplete=true&exactSpelling=false&fuzzyMatch=false&matchPrecisionNot=&locationDescriptor=frontDoorPoint&addressString='

export const FILTER_KEYS = {
  COMPLIANCE_REPORT_GRID: 'compliance-reports-grid-filter',
  TRANSACTIONS_GRID: 'transactions-grid-filter',
  FUEL_CODES_GRID: 'fuel-codes-grid-filter'
}

export const MAX_FILE_SIZE_BYTES = 52428800 // 50MB

export const LEGISLATION_TRANSITION_YEAR = 2024

export const isLegacyCompliancePeriod = (compliancePeriod) => {
  // If it's already a number, use it directly
  if (typeof compliancePeriod === 'number') {
    return compliancePeriod < LEGISLATION_TRANSITION_YEAR
  }

  // Try to parse it as a number
  const parsedPeriod = Number(compliancePeriod)

  // If parsing failed or resulted in NaN, return false
  if (isNaN(parsedPeriod)) {
    return false
  }

  return parsedPeriod < LEGISLATION_TRANSITION_YEAR
}

