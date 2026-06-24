import DOMPurify from 'dompurify'

// Single, conservative allow-list for rich-text comment bodies.
// Mirrors what the BC Quill editor produces and what
// `sanitize_comment_text` strips on the server.
const ALLOWED_TAGS = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'u',
  'ul'
]

const ALLOWED_ATTR = ['class', 'href', 'rel', 'target', 'title']

export const sanitizeCommentHtml = (
  html: string | null | undefined
): string => {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick']
  })
}
