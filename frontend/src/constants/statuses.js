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
}

export const TRANSFER_RECOMMENDATION = {
  RECORD: 'Record',
  REFUSE: 'Refuse'
}

export const TRANSACTION_STATUSES = {
  NEW: 'New', // Limited only for frontend
  DRAFT: 'Draft',
  RECOMMENDED: 'Recommended',
  APPROVED: 'Approved',
  DELETED: 'Deleted'
}

export const ORGANIZATION_STATUSES = {
  UNREGISTERED: 'Unregistered',
  REGISTERED: 'Registered',
  SUSPENDED: 'Suspended',
  CANCELED: 'Canceled'
}

export const COMPLIANCE_REPORT_STATUSES = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  ASSESSED: 'Assessed',
  REASSESSED: 'Reassessed',
  RECOMMENDED_BY_ANALYST: 'Recommended by analyst',
  RECOMMENDED_BY_MANAGER: 'Recommended by manager'
}
export function getAllOrganizationStatuses() {
  return Object.values(ORGANIZATION_STATUSES)
}

export function getAllTerminalTransferStatuses() {
  return [TRANSFER_STATUSES.DECLINED, TRANSFER_STATUSES.DELETED, TRANSFER_STATUSES.RESCINDED, TRANSFER_STATUSES.REFUSED, TRANSFER_STATUSES.RECORDED]
}

export const FUEL_CODE_STATUSES = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  DELETED: 'Deleted'
}

export function getAllFuelCodeStatuses() {
  return Object.values(FUEL_CODE_STATUSES)
}