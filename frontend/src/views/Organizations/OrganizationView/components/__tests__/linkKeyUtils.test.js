import { describe, it, expect } from 'vitest'
import {
  normalizeFormId,
  normalizeKeyData,
  generateFormLink,
  hasExistingKey,
  getExistingKey,
  buildCacheFromLinkKeys,
  updateCacheEntry,
  removeCacheEntry
} from '../linkKeyUtils'

describe('linkKeyUtils', () => {
  it('normalizeFormId handles numbers, strings and invalids', () => {
    expect(normalizeFormId(5)).toBe(5)
    expect(normalizeFormId('6')).toBe(6)
    expect(normalizeFormId('x')).toBeNull()
    expect(normalizeFormId(undefined)).toBeNull()
    expect(normalizeFormId(null)).toBeNull()
  })

  it('normalizeKeyData maps various api shapes', () => {
    expect(
      normalizeKeyData({
        form_id: 1,
        form_slug: 'a',
        link_key: 'k',
        create_date: 'd'
      })
    ).toEqual({ formId: 1, formSlug: 'a', linkKey: 'k', createDate: 'd' })

    expect(
      normalizeKeyData({
        formId: 2,
        formSlug: 'b',
        linkKey: 'k2',
        createDate: 'd2'
      })
    ).toEqual({ formId: 2, formSlug: 'b', linkKey: 'k2', createDate: 'd2' })

    expect(
      normalizeKeyData({
        form: { id: 3 },
        slug: 'c',
        key: 'k3',
        created_at: 'd3'
      })
    ).toEqual({ formId: 3, formSlug: 'c', linkKey: 'k3', createDate: 'd3' })
  })

  it('generateFormLink builds link with custom base', () => {
    expect(generateFormLink('form-a', 'abc', 'https://app')).toBe(
      'https://app/forms/form-a/abc'
    )
  })

  it('hasExistingKey checks cache first then list', () => {
    const list = [
      { formId: 1, formSlug: 'a', linkKey: 'x' },
      { formId: 2, formSlug: 'b', linkKey: 'y' }
    ]
    const cache = { 3: { linkKey: 'z' } }

    expect(hasExistingKey(list, cache, 3)).toBe(true) // from cache
    expect(hasExistingKey(list, cache, 2)).toBe(true) // from list
    expect(hasExistingKey(list, cache, 99)).toBe(false)
  })

  it('getExistingKey returns cached first then from list or null', () => {
    const list = [
      { formId: 1, formSlug: 'a', linkKey: 'x' },
      { formId: 2, formSlug: 'b', linkKey: 'y' }
    ]
    const cache = { 2: { linkKey: 'cached', formSlug: 'b' } }

    expect(getExistingKey(list, cache, 2)).toEqual({
      linkKey: 'cached',
      formSlug: 'b'
    })
    expect(getExistingKey(list, {}, 1)).toEqual(list[0])
    expect(getExistingKey(list, {}, 77)).toBeUndefined()
  })

  it('buildCacheFromLinkKeys creates id-indexed cache', () => {
    const cache = buildCacheFromLinkKeys([
      { formId: 1, formSlug: 'a', linkKey: 'k1', createDate: 'd1' },
      { formId: 2, formSlug: 'b', linkKey: 'k2', createDate: 'd2' }
    ])
    expect(cache).toEqual({
      1: { formSlug: 'a', linkKey: 'k1', createDate: 'd1' },
      2: { formSlug: 'b', linkKey: 'k2', createDate: 'd2' }
    })
  })

  it('updateCacheEntry and removeCacheEntry are pure and safe', () => {
    const original = { 1: { linkKey: 'k1' } }
    const updated = updateCacheEntry(original, '2', { linkKey: 'k2' })
    expect(updated).toEqual({ 1: { linkKey: 'k1' }, 2: { linkKey: 'k2' } })
    expect(original).toEqual({ 1: { linkKey: 'k1' } }) // purity

    const removed = removeCacheEntry(updated, 1)
    expect(removed).toEqual({ 2: { linkKey: 'k2' } })

    // Invalid id yields unchanged object
    expect(removeCacheEntry(updated, 'x')).toBe(updated)
  })
})
