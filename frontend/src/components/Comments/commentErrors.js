/** Return displayable text for network errors and FastAPI validation details. */
export const getCommentErrorMessage = (error) => {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (typeof item?.msg === 'string' ? item.msg : null))
      .filter(Boolean)
    if (messages.length) return messages.join(' ')
  }
  return typeof error?.message === 'string' ? error.message : ''
}
