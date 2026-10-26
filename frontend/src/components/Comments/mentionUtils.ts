export interface MentionTrigger {
  /** Index of the triggering "@" within the text that was scanned. */
  anchorIndex: number
  query: string
}

// "@" must follow whitespace or start-of-line (so "a@b.com" doesn't trigger).
// The query may contain one space, so "@Al Ring" searches as a full name.
const MENTION_TRIGGER_RE = /(?:^|\s)@([^\s@]{0,30}(?: [^\s@]{0,30})?)$/

/** The in-progress "@query" at the end of `textBeforeCursor`, or null. */
export const parseMentionTrigger = (
  textBeforeCursor: string
): MentionTrigger | null => {
  const match = MENTION_TRIGGER_RE.exec(textBeforeCursor)
  if (!match) return null
  const query = match[1]
  return {
    anchorIndex: textBeforeCursor.length - query.length - 1,
    query
  }
}

/** True if `html` contains at least one inserted @mention token. */
export const containsMentionMarkup = (
  html: string | null | undefined
): boolean => !!html && html.includes('class="mention"')

/** Delete every mention (name included) and tidy the leftover whitespace. */
export const removeMentionMarkup = (html: string): string => {
  if (!containsMentionMarkup(html)) return html
  const template = document.createElement('template')
  template.innerHTML = html
  template.content
    .querySelectorAll('span.mention')
    .forEach((node) => node.remove())
  return template.innerHTML
    .replace(/(?:&nbsp;|\s){2,}/g, ' ')
    .replace(/(<(?:p|li)[^>]*>)(?:&nbsp;|\s)+/g, '$1')
    .replace(/(?:&nbsp;|\s)+(<\/(?:p|li)>)/g, '$1')
    .replace(/<(p|li)([^>]*)><\/\1>/g, '<$1$2><br></$1>')
}

/** Mention pill, shared by the editor and rendered comments. */
export const MENTION_CHIP_STYLE = {
  display: 'inline',
  backgroundColor: '#e6eef8',
  color: '#003366',
  borderRadius: '999px',
  padding: '0 6px',
  margin: 0,
  fontWeight: 500,
  fontSize: 'inherit',
  lineHeight: 'inherit',
  whiteSpace: 'nowrap',
  boxDecorationBreak: 'clone',
  WebkitBoxDecorationBreak: 'clone',
  cursor: 'default'
} as const

export const MENTION_LISTBOX_ID = 'comment-mention-listbox'
export const getMentionOptionId = (index: number): string =>
  `comment-mention-option-${index}`

// Palette shared with the GlobalSearch dropdown.
export const MENTION_COLORS = {
  border: '#d8d8d8',
  select: 'rgba(56, 89, 138, 0.12)',
  activeBlue: '#38598a',
  text: '#2d2d2d',
  muted: '#474543'
} as const
