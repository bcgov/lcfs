import { describe, expect, it } from 'vitest'
import { sanitizeCommentHtml } from '../sanitize'

describe('sanitizeCommentHtml', () => {
  it('returns empty string for nullish input', () => {
    expect(sanitizeCommentHtml(null)).toBe('')
    expect(sanitizeCommentHtml(undefined)).toBe('')
    expect(sanitizeCommentHtml('')).toBe('')
  })

  it('keeps a safe allow-listed subset (p, strong, em, ul, li, a)', () => {
    const html =
      '<p>Hi <strong>there</strong> <em>now</em></p><ul><li>one</li></ul><a href="https://example.com" rel="noopener" target="_blank">link</a>'
    const out = sanitizeCommentHtml(html)
    expect(out).toContain('<strong>there</strong>')
    expect(out).toContain('<em>now</em>')
    expect(out).toContain('<li>one</li>')
    expect(out).toContain('href="https://example.com"')
  })

  it('strips <script> and on* handlers', () => {
    const html =
      '<p onclick="alert(1)">x</p><script>window.__pwned = true</script><img src=x onerror=alert(1) />'
    const out = sanitizeCommentHtml(html)
    expect(out).not.toMatch(/<script/i)
    expect(out).not.toMatch(/onerror=/i)
    expect(out).not.toMatch(/onclick=/i)
    expect(window.__pwned).toBeUndefined()
  })

  it('strips inline style attributes', () => {
    const out = sanitizeCommentHtml(
      '<p style="background:url(javascript:alert(1))">x</p>'
    )
    expect(out).not.toMatch(/style=/i)
  })

  it('strips <iframe>', () => {
    const out = sanitizeCommentHtml(
      '<iframe src="https://evil.example.com"></iframe>'
    )
    expect(out).not.toMatch(/<iframe/i)
  })
})
