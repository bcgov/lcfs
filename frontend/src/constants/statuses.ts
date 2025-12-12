export const TRANSFER_STATUSES = {
  NEW: 'New', // Limited only for frontend
  DRAFT: 'Draft',
  DELETED: 'Deleted',
  SENT: 'Sent',
  SUBMITTED: 'Submitted',
  RECOMMENDED: 'Recommended',
  RECORDED: 'Recorded',
  REFUSED: 'Refused',
  DECLINED: 'Declined',
  RESCINDED: 'Rescinded'
} as const

export type TransferStatus =
  (typeof TRANSFER_STATUSES)[keyof typeof TRANSFER_STATUSES]

export const TRANSFER_RECOMMENDATION = {
  RECORD: 'Record',
  REFUSE: 'Refuse'
} as const

export type TransferRecommendation =
  (typeof TRANSFER_RECOMMENDATION)[keyof typeof TRANSFER_RECOMMENDATION]

export const TRANSACTION_STATUSES = {
  NEW: 'New', // Limited only for frontend
  DRAFT: 'Draft',
  RECOMMENDED: 'Recommended',
  APPROVED: 'Approved',
  DELETED: 'Deleted'
} as const

export const ORGANIZATION_STATUSES = {
  UNREGISTERED: 'Unregistered',
  REGISTERED: 'Registered',
  SUSPENDED: 'Suspended',
  CANCELED: 'Canceled'
} as const

export type OrganizationStatus =
  (typeof ORGANIZATION_STATUSES)[keyof typeof ORGANIZATION_STATUSES]

export const COMPLIANCE_REPORT_STATUSES = {
  DRAFT: 'Draft',
  DELETED: 'Deleted',
  SUBMITTED: 'Submitted',
  ANALYST_ADJUSTMENT: 'Analyst adjustment',
  RECOMMENDED_BY_ANALYST: 'Recommended by analyst',
  RECOMMENDED_BY_MANAGER: 'Recommended by manager',
  SUPPLEMENTAL_REQUESTED: 'Supplemental requested',
  ASSESSED: 'Assessed',
  REJECTED: 'Rejected',
  RETURN_TO_ANALYST: 'Return to analyst',
  RETURN_TO_MANAGER: 'Return to manager',
  RETURN_TO_SUPPLIER: 'Return to supplier'
} as const

export function getAllOrganizationStatuses(): OrganizationStatus[] {
  return Object.values(ORGANIZATION_STATUSES)
}

export function getAllTerminalTransferStatuses(): TransferStatus[] {
  return [
    TRANSFER_STATUSES.DECLINED,
    TRANSFER_STATUSES.DELETED,
    TRANSFER_STATUSES.RESCINDED,
    TRANSFER_STATUSES.REFUSED,
    TRANSFER_STATUSES.RECORDED
  ]
}

export const FUEL_CODE_STATUSES = {
  DRAFT: 'Draft',
  RECOMMENDED: 'Recommended',
  APPROVED: 'Approved',
  DELETED: 'Deleted'
} as const

export type FuelCodeStatus =
  (typeof FUEL_CODE_STATUSES)[keyof typeof FUEL_CODE_STATUSES]

export function getAllFuelCodeStatuses(): FuelCodeStatus[] {
  return Object.values(FUEL_CODE_STATUSES)
}

export const TRANSACTION_TYPES = {
  TRANSFER: 'Transfer',
  INITIATIVE_AGREEMENT: 'InitiativeAgreement',
  COMPLIANCE_REPORT: 'ComplianceReport',
  ADMINISTRATIVE_ADJUSTMENT: 'AdminAdjustment'
} as const

export const REPORT_SCHEDULES_VIEW = {
  EDIT: 'edit',
  VIEW: 'view',
  CHANGELOG: 'changelog'
} as const
