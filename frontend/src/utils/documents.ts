interface DisplayableDocument {
  displayName?: string | null
  fileName?: string | null
}

interface ScannedDocument {
  scanStatus?: string | null
}

export const getDocumentDisplayName = (
  document?: DisplayableDocument | null
): string | null | undefined => document?.displayName || document?.fileName

// Macro-enabled workbooks can't be opened until an administrator approves them
export const LOCKED_SCAN_STATUSES: readonly string[] = [
  'pending_approval',
  'rejected'
]

export const isDocumentLocked = (document?: ScannedDocument | null): boolean =>
  LOCKED_SCAN_STATUSES.includes(document?.scanStatus ?? '')

// Files that carried macros and went through the approval step
export const hasScanReview = (document?: ScannedDocument | null): boolean =>
  [...LOCKED_SCAN_STATUSES, 'approved'].includes(document?.scanStatus ?? '')
