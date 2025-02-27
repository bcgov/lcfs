import { describe, expect, it } from 'vitest'
import { isArrayEmpty } from '@/utils/array.js'

describe('isArrayEmpty', () => {
  it('should return true for empty arrays', () => {
    expect(isArrayEmpty([])).toEqual(true)
  })

  it('should return false for non-empty arrays', () => {
    expect(isArrayEmpty([1, 2, 3])).toEqual(false)
  })

  it('should return null for non-array inputs', () => {
    expect(isArrayEmpty({})).toEqual(null)
  })
})
