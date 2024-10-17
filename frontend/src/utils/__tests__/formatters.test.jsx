import { describe, it, expect } from 'vitest'
import { numberFormatter } from '@/utils/formatters'

describe('numberFormatter', () => {
  it('should format integers correctly', () => {
    expect(numberFormatter({ value: '1234' })).toBe('1,234')
    expect(numberFormatter(5678)).toBe('5,678')
  })

  it('should format floating-point numbers correctly', () => {
    expect(numberFormatter({ value: '1234.56789' })).toBe('1,234.56789')
    expect(numberFormatter('5678.12345')).toBe('5,678.12345')
  })

  it('should handle null and undefined values', () => {
    expect(numberFormatter(null)).toBe('')
    expect(numberFormatter(undefined)).toBe('')
    expect(numberFormatter({ value: null })).toBe('')
    expect(numberFormatter({ value: undefined })).toBe('')
  })

  it('should handle invalid numbers gracefully', () => {
    expect(numberFormatter({ value: 'abc' })).toBe('abc')
    expect(numberFormatter('abc')).toBe('abc')
  })

  it('should format zero correctly', () => {
    expect(numberFormatter({ value: '0' })).toBe('0')
    expect(numberFormatter(0)).toBe('0')
  })

  it('should handle large numbers correctly', () => {
    expect(numberFormatter({ value: '1234567890' })).toBe('1,234,567,890')
    expect(numberFormatter(9876543210)).toBe('9,876,543,210')
  })

  it('should handle negative numbers correctly', () => {
    expect(numberFormatter({ value: '-1234.56789' })).toBe('-1,234.56789')
    expect(numberFormatter('-5678.12345')).toBe('-5,678.12345')
  })

  it('should format numbers with up to 10 decimal places correctly', () => {
    expect(numberFormatter({ value: '1234.5678901234' })).toBe(
      '1,234.5678901234'
    )
    expect(numberFormatter('5678.1234567890')).toBe('5,678.123456789')
  })

  it('should format numbers with more than 10 decimal places by rounding', () => {
    expect(numberFormatter({ value: '1234.567890123456' })).toBe(
      '1,234.5678901235'
    )
    expect(numberFormatter('5678.123456789012')).toBe('5,678.123456789')
  })

  describe('useParentheses option', () => {
    it('should format negative numbers with parentheses when useParentheses is true', () => {
      expect(numberFormatter({ value: '-1234.56' }, true)).toBe('(1,234.56)')
      expect(numberFormatter(-5678.12, true)).toBe('(5,678.12)')
    })

    it('should format negative numbers with a minus sign when useParentheses is false', () => {
      expect(numberFormatter({ value: '-1234.56' }, false)).toBe('-1,234.56')
      expect(numberFormatter(-5678.12, false)).toBe('-5,678.12')
    })

    it('should format negative numbers with a minus sign by default', () => {
      expect(numberFormatter({ value: '-1234.56' })).toBe('-1,234.56')
      expect(numberFormatter(-5678.12)).toBe('-5,678.12')
    })

    it('should not affect positive numbers when useParentheses is true', () => {
      expect(numberFormatter({ value: '1234.56' }, true)).toBe('1,234.56')
      expect(numberFormatter(5678.12, true)).toBe('5,678.12')
    })

    it('should handle zero correctly with useParentheses option', () => {
      expect(numberFormatter({ value: '0' }, true)).toBe('0')
      expect(numberFormatter(0, true)).toBe('0')
    })

    it('should handle large negative numbers correctly with useParentheses option', () => {
      expect(numberFormatter({ value: '-1234567890.12' }, true)).toBe(
        '(1,234,567,890.12)'
      )
      expect(numberFormatter(-9876543210.98, true)).toBe('(9,876,543,210.98)')
    })
  })
})
