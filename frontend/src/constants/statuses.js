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

export const ORGANIZATION_STATUSES = {
  UNREGISTERED: 'Unregistered',
  REGISTERED: 'Registered',
  SUSPENDED: 'Suspended',
  CANCELED: 'Canceled'
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