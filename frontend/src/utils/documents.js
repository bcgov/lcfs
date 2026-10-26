export const getDocumentDisplayName = (document) =>
  document?.displayName || document?.fileName

// Macro-enabled workbooks can't be opened until an administrator approves them
export const LOCKED_SCAN_STATUSES = ['pending_approval', 'rejected']

export const isDocumentLocked = (document) =>
  LOCKED_SCAN_STATUSES.includes(document?.scanStatus)

// Files that carried macros and went through the approval step
export const hasScanReview = (document) =>
  [...LOCKED_SCAN_STATUSES, 'approved'].includes(document?.scanStatus)
