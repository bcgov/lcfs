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

const SEARCH_TERM_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu

const getSearchTerms = (search: string): string[] =>
  [
    ...new Set(search.toLocaleLowerCase().match(SEARCH_TERM_PATTERN) ?? [])
  ].sort((a, b) => b.length - a.length)

/**
 * Sanitize a rich-text comment, then add semantic <mark> elements around
 * matching text. Search input is only ever assigned through textContent, so it
 * cannot introduce markup into the sanitized comment.
 */
export const sanitizeAndHighlightCommentHtml = (
  html: string | null | undefined,
  search: string | null | undefined
): string => {
  const sanitizedHtml = sanitizeCommentHtml(html)
  const terms = getSearchTerms(search ?? '')
  if (!sanitizedHtml || terms.length === 0) return sanitizedHtml

  const pattern = new RegExp(`(${terms.join('|')})`, 'giu')
  const template = document.createElement('template')
  template.innerHTML = sanitizedHtml

  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_TEXT
  )
  const textNodes: Text[] = []
  let currentNode = walker.nextNode()
  while (currentNode) {
    textNodes.push(currentNode as Text)
    currentNode = walker.nextNode()
  }

  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? ''
    const parts = text.split(pattern)
    if (parts.length === 1) continue

    const fragment = document.createDocumentFragment()
    parts.forEach((part, index) => {
      if (index % 2 === 0) {
        fragment.append(document.createTextNode(part))
        return
      }
      const mark = document.createElement('mark')
      mark.className = 'comment-search-highlight'
      mark.textContent = part
      fragment.append(mark)
    })
    textNode.replaceWith(fragment)
  }

  return template.innerHTML
}
