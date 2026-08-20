import { describe, it, expect } from 'vitest'
import { constructAddress } from '../constructAddress'

describe('constructAddress', () => {
  it('joins all non-empty parts with a comma', () => {
    const address = {
      streetAddress: '123 Main St',
      city: 'Victoria',
      provinceState: 'BC',
      country: 'Canada',
      postalcodeZipcode: 'V8W 1A1'
    }
    expect(constructAddress(address)).toBe(
      '123 Main St, Victoria, BC, Canada, V8W 1A1'
    )
  })

  it('prepends addressOther with a dash separator when provided', () => {
    const address = {
      addressOther: 'Suite 400',
      streetAddress: '456 Oak Ave',
      city: 'Vancouver',
      provinceState: 'BC',
      country: 'Canada',
      postalcodeZipcode: 'V6B 2K3'
    }
    expect(constructAddress(address)).toBe(
      'Suite 400 -, 456 Oak Ave, Vancouver, BC, Canada, V6B 2K3'
    )
  })

  it('omits missing fields gracefully', () => {
    const address = {
      streetAddress: '789 Pine Rd',
      city: 'Kelowna'
    }
    expect(constructAddress(address)).toBe('789 Pine Rd, Kelowna')
  })

  it('returns empty string when all fields are empty strings', () => {
    const address = {
      streetAddress: '',
      addressOther: '',
      city: '',
      provinceState: '',
      country: '',
      postalcodeZipcode: ''
    }
    expect(constructAddress(address)).toBe('')
  })

  it('returns empty string for null input', () => {
    expect(constructAddress(null)).toBe('')
  })

  it('returns empty string for undefined input', () => {
    expect(constructAddress(undefined)).toBe('')
  })

  it('filters out whitespace-only fields', () => {
    const address = {
      streetAddress: '10 Elm St',
      city: '   ',
      provinceState: 'BC'
    }
    expect(constructAddress(address)).toBe('10 Elm St, BC')
  })

  it('handles an address with only postalcode', () => {
    const address = { postalcodeZipcode: 'A1A 1A1' }
    expect(constructAddress(address)).toBe('A1A 1A1')
  })

  it('returns only addressOther dash when street and city are missing', () => {
    const address = { addressOther: 'PO Box 100' }
    expect(constructAddress(address)).toBe('PO Box 100 -')
  })
})
