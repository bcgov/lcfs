import { describe, expect, it } from 'vite-plus/test'
import { evidenceEditorHtml, evidencePlainText } from '../evidenceRichText'

describe('evidence rich text', () => {
  it('preserves legacy plain text and line breaks in the editor', () => {
    expect(evidenceEditorHtml('Permits & approvals\nStage 2')).toBe(
      '<p>Permits &amp; approvals<br>Stage 2</p>'
    )
  })

  it('preserves supported formatting while sanitizing unsafe markup', () => {
    const html = evidenceEditorHtml(
      '<p class="ql-align-right"><strong>Evidence</strong></p><script>alert(1)</script>'
    )
    expect(html).toContain('class="ql-align-right"')
    expect(html).toContain('<strong>Evidence</strong>')
    expect(html).not.toContain('<script')
    expect(
      evidenceEditorHtml('<a href="javascript:alert(1)">Link</a>')
    ).not.toContain('javascript:')
  })

  it('treats blank rich-text documents as empty', () => {
    for (const value of [null, undefined, '', '<p><br></p>', '<p>&nbsp;</p>']) {
      expect(evidencePlainText(value)).toBe('')
    }
  })

  it('extracts readable history text with paragraph and list boundaries', () => {
    expect(
      evidencePlainText('<p>Evidence</p><ul><li>First</li><li>Second</li></ul>')
    ).toBe('Evidence\nFirst\nSecond')
  })
})
