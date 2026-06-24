export const formatCommentDateTime = (
  raw: string | null | undefined
): string => {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export const isCommentEdited = (
  createDate: string | null | undefined,
  updateDate: string | null | undefined
): boolean => {
  if (!createDate || !updateDate) return false
  // Treat as edited only when the timestamps differ at second granularity.
  return new Date(updateDate).getTime() - new Date(createDate).getTime() >= 1000
}
