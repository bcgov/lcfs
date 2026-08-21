import { describe, expect, it } from 'vitest'
import { sanitizeCommentHtml } from '../sanitizeCommentHtml'

describe('sanitizeCommentHtml', () => {
  it('keeps the rich text the comment editor produces', () => {
    const html = '<p><strong>bold</strong> and <em>italic</em></p><ul><li>item</li></ul>'
    expect(sanitizeCommentHtml(html)).toContain('<strong>bold</strong>')
    expect(sanitizeCommentHtml(html)).toContain('<li>item</li>')
  })

  it('strips script tags and event handlers', () => {
    const dirty = '<p onclick="steal()">hi</p><script>steal()</script>'
    const clean = sanitizeCommentHtml(dirty)
    expect(clean).not.toContain('script')
    expect(clean).not.toContain('onclick')
    expect(clean).toContain('hi')
  })

  it('strips an image error handler', () => {
    const clean = sanitizeCommentHtml('<img src=x onerror="steal()">')
    expect(clean).not.toContain('onerror')
  })

  it('handles empty input', () => {
    expect(sanitizeCommentHtml('')).toBe('')
    expect(sanitizeCommentHtml(null)).toBe('')
    expect(sanitizeCommentHtml(undefined)).toBe('')
  })
})
