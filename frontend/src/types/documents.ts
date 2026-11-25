/** Metadata returned for an uploaded document or used by optimistic upload rows. */
export interface DocumentMetadata {
  documentId: number | string
  fileName: string
  fileSize: number
  createDate: string | null
  createUser?: string | null
  displayName?: string | null
  scanStatus?: string | null
  scanning?: boolean
  deleting?: boolean
  virus?: boolean
  oversize?: boolean
  error?: boolean
  errorMessage?: string | null
}

/** Minimum document fields accepted by preview controls and linked evidence. */
export interface DocumentPreviewMetadata {
  documentId: number | string
  fileName?: string | null
  displayName?: string | null
  scanStatus?: string | null
}
