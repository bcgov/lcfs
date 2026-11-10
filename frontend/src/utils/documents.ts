interface DisplayableDocument {
  displayName?: string | null
  fileName?: string | null
}

export const getDocumentDisplayName = (
  document?: DisplayableDocument | null
): string | null | undefined => document?.displayName || document?.fileName
