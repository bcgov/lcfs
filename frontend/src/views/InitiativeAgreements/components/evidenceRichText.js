import { sanitizeCommentHtml } from '@/utils/sanitizeCommentHtml'

export const evidencePlainText = (value) => {
  const element = document.createElement('div')
  element.innerHTML = sanitizeCommentHtml(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li)>/gi, '\n')
  return element.textContent?.trim() ?? ''
}

export const evidenceEditorHtml = (value) => {
  if (!value) return ''
  if (/<\/?[a-z][^>]*>/i.test(value)) return sanitizeCommentHtml(value)
  const element = document.createElement('div')
  element.textContent = value
  return `<p>${element.innerHTML.replace(/\n/g, '<br>')}</p>`
}
