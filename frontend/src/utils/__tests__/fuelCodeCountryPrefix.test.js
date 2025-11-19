import { describe, it, expect } from 'vitest'
import {
  getCountryPrefix,
  formatFuelCodeWithCountryPrefix,
  extractOriginalFuelCode,
  formatFuelCodeOptions
} from '@/utils/fuelCodeCountryPrefix'

describe('getCountryPrefix', () => {
  it('should return "C-" prefix for Canada (case insensitive)', () => {
    expect(getCountryPrefix('Canada')).toBe('C-')
    expect(getCountryPrefix('canada')).toBe('C-')
    expect(getCountryPrefix('CANADA')).toBe('C-')
    expect(getCountryPrefix('CaNaDa')).toBe('C-')
  })

  it('should handle Canada with extra whitespace', () => {
    expect(getCountryPrefix('  Canada  ')).toBe('C-')
    expect(getCountryPrefix(' canada ')).toBe('C-')
    expect(getCountryPrefix('\tCanada\n')).toBe('C-')
  })

  it('should return empty string for non-Canadian countries', () => {
    expect(getCountryPrefix('United States')).toBe('')
    expect(getCountryPrefix('USA')).toBe('')
    expect(getCountryPrefix('Mexico')).toBe('')
    expect(getCountryPrefix('Germany')).toBe('')
    expect(getCountryPrefix('Unknown Country')).toBe('')
  })

  it('should return empty string for null, undefined, or empty input', () => {
    expect(getCountryPrefix(null)).toBe('')
    expect(getCountryPrefix(undefined)).toBe('')
    expect(getCountryPrefix('')).toBe('')
    expect(getCountryPrefix('   ')).toBe('')
  })
})



describe('extractOriginalFuelCode', () => {
  it('should extract original fuel code from C- prefixed codes', () => {
    expect(extractOriginalFuelCode('C-BCLCF101.1')).toBe('BCLCF101.1')
    expect(extractOriginalFuelCode('C-FC123')).toBe('FC123')
    expect(extractOriginalFuelCode('C-TEST')).toBe('TEST')
    expect(extractOriginalFuelCode('C-A')).toBe('A')
  })

  it('should return original code if no prefix is found', () => {
    expect(extractOriginalFuelCode('BCLCF101.1')).toBe('BCLCF101.1')
    expect(extractOriginalFuelCode('FC123')).toBe('FC123')
    expect(extractOriginalFuelCode('TEST')).toBe('TEST')
  })

  it('should handle codes that start with C but are not prefixed', () => {
    expect(extractOriginalFuelCode('CANADA123')).toBe('CANADA123')
    expect(extractOriginalFuelCode('C123')).toBe('C123')
    expect(extractOriginalFuelCode('C')).toBe('C')
  })

  it('should handle edge cases', () => {
    expect(extractOriginalFuelCode(null)).toBe(null)
    expect(extractOriginalFuelCode(undefined)).toBe(undefined)
    expect(extractOriginalFuelCode('')).toBe('')
    expect(extractOriginalFuelCode('C-')).toBe('')
  })

  it('should handle multiple prefixes correctly', () => {
    // Should only remove the first matching prefix
    expect(extractOriginalFuelCode('C-C-TEST')).toBe('C-TEST')
  })
})


