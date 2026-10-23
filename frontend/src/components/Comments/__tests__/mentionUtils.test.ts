import { describe, expect, it } from 'vitest'
import {
  containsMentionMarkup,
  parseMentionTrigger,
  removeMentionMarkup
} from '../mentionUtils'

describe('parseMentionTrigger', () => {
  it('returns null when there is no "@"', () => {
    expect(parseMentionTrigger('hello world')).toBeNull()
  })

  it('detects a bare "@" at the start of the text', () => {
    expect(parseMentionTrigger('@')).toEqual({ anchorIndex: 0, query: '' })
  })

  it('detects "@" preceded by whitespace', () => {
    expect(parseMentionTrigger('hello @ja')).toEqual({
      anchorIndex: 6,
      query: 'ja'
    })
  })

  it('does not trigger mid-word (e.g. an email address)', () => {
    expect(parseMentionTrigger('contact me at jane@example')).toBeNull()
  })

  it('allows one internal space to keep searching a "First Last" name', () => {
    expect(parseMentionTrigger('@Al')).toEqual({ anchorIndex: 0, query: 'Al' })
    expect(parseMentionTrigger('@Al ')).toEqual({
      anchorIndex: 0,
      query: 'Al '
    })
    expect(parseMentionTrigger('@Al Ring')).toEqual({
      anchorIndex: 0,
      query: 'Al Ring'
    })
  })

  it('stops matching once a second space starts a third word', () => {
    expect(parseMentionTrigger('@Al Ring Extra')).toBeNull()
  })

  it('does not trigger across a second "@"', () => {
    expect(parseMentionTrigger('@jane@doe')).toBeNull()
  })
})

describe('containsMentionMarkup', () => {
  it('detects an inserted mention token', () => {
    expect(
      containsMentionMarkup(
        '<p>Hi <span class="mention" data-mention-id="5">@Jane Doe</span></p>'
      )
    ).toBe(true)
  })

  it('returns false for plain text', () => {
    expect(containsMentionMarkup('<p>hello world</p>')).toBe(false)
    expect(containsMentionMarkup(null)).toBe(false)
    expect(containsMentionMarkup(undefined)).toBe(false)
  })
})

describe('removeMentionMarkup', () => {
  it('deletes the mention entirely and collapses the leftover space', () => {
    const html =
      '<p>Hi <span class="mention" data-mention-id="5" ' +
      'data-mention-name="Jane Doe">@Jane Doe</span> how are you?</p>'
    expect(removeMentionMarkup(html)).toBe('<p>Hi how are you?</p>')
  })

  it('trims whitespace left at the end of a paragraph', () => {
    const html =
      '<p>Thanks <span class="mention" data-mention-id="18" ' +
      'contenteditable="false">\uFEFF<span contenteditable="false">' +
      '@Al Ring</span>\uFEFF</span> </p>'
    expect(removeMentionMarkup(html)).toBe('<p>Thanks</p>')
  })

  it('leaves an empty paragraph editable', () => {
    const html =
      '<p><span class="mention" data-mention-id="5">@Jane Doe</span></p>'
    expect(removeMentionMarkup(html)).toBe('<p><br></p>')
  })

  it('returns the input unchanged when there is no mention', () => {
    const html = '<p>no mentions here</p>'
    expect(removeMentionMarkup(html)).toBe(html)
  })
})
