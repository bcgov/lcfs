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

export const REPORT_SCHEDULES = {
  ANNUAL: 'Annual',
  QUARTERLY: 'Quarterly'
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

// File upload constants for compliance reports
export const COMPLIANCE_REPORT_FILE_TYPES = {
  MIME_TYPES: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain'
  ],
  DESCRIPTION:
    'PDF, PNG, JPG/JPEG, Word Documents (.doc/.docx), Excel Spreadsheets (.xls/.xlsx), CSV, TXT',
  get ACCEPT_STRING() {
    return this.MIME_TYPES.join(',')
  }
}

// File upload constants for schedule imports
export const SCHEDULE_IMPORT_FILE_TYPES = {
  MIME_TYPES: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ],
  DESCRIPTION: 'Excel files (.xlsx)',
  get ACCEPT_STRING() {
    return this.MIME_TYPES.join(',')
  }
}

export const FUEL_CATEGORIES = ['Diesel', 'Gasoline', 'Jet fuel']
export const LEGISLATION_TRANSITION_YEAR = 2024

export const CURRENT_COMPLIANCE_YEAR = (
  LEGISLATION_TRANSITION_YEAR + 1
).toString()
