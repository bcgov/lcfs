import { describe, it, expect } from 'vitest'
import {
  cleanEmptyStringValues,
  formatNumberWithoutCommas,
  isNumeric,
  numberFormatter,
  calculateRowHeight,
  decimalFormatter,
  calculateTotalValue,
  currencyFormatter,
  dateFormatter,
  dateToLongString,
  phoneNumberFormatter,
  formatNumberWithCommas,
  spacesFormatter,
  timezoneFormatter,
  convertObjectKeys
} from '@/utils/formatters'
import { roles } from '@/constants/roles'

describe('numberFormatter', () => {
  it('should format integers correctly', () => {
    expect(numberFormatter({ value: '1234' })).toEqual('1,234')
    expect(numberFormatter(5678)).toEqual('5,678')
  })

  it('should format floating-point numbers correctly', () => {
    expect(numberFormatter({ value: '1234.56789' })).toEqual('1,234.56789')
    expect(numberFormatter('5678.12345')).toEqual('5,678.12345')
  })

  it('should handle null and undefined values', () => {
    expect(numberFormatter(null)).toEqual('')
    expect(numberFormatter(undefined)).toEqual('')
    expect(numberFormatter({ value: null })).toEqual('')
    expect(numberFormatter({ value: undefined })).toEqual('')
  })

  it('should handle invalid numbers gracefully', () => {
    expect(numberFormatter({ value: 'abc' })).toEqual('abc')
    expect(numberFormatter('abc')).toEqual('abc')
  })

  it('should format zero correctly', () => {
    expect(numberFormatter({ value: '0' })).toEqual('0')
    expect(numberFormatter(0)).toEqual('0')
  })

  it('should handle large numbers correctly', () => {
    expect(numberFormatter({ value: '1234567890' })).toEqual('1,234,567,890')
    expect(numberFormatter(9876543210)).toEqual('9,876,543,210')
  })

  it('should handle negative numbers correctly', () => {
    expect(numberFormatter({ value: '-1234.56789' })).toEqual('-1,234.56789')
    expect(numberFormatter('-5678.12345')).toEqual('-5,678.12345')
  })

  it('should format numbers with up to 10 decimal places correctly', () => {
    expect(numberFormatter({ value: '1234.5678901234' })).toEqual(
      '1,234.5678901234'
    )
    expect(numberFormatter('5678.1234567890')).toEqual('5,678.123456789')
  })

  it('should format numbers with more than 10 decimal places by rounding', () => {
    expect(numberFormatter({ value: '1234.567890123456' })).toEqual(
      '1,234.5678901235'
    )
    expect(numberFormatter('5678.123456789012')).toEqual('5,678.123456789')
  })

  describe('useParentheses option', () => {
    it('should format negative numbers with parentheses when useParentheses is true', () => {
      expect(numberFormatter({ value: '-1234.56' }, true)).toEqual('(1,234.56)')
      expect(numberFormatter(-5678.12, true)).toEqual('(5,678.12)')
    })

    it('should format negative numbers with a minus sign when useParentheses is false', () => {
      expect(numberFormatter({ value: '-1234.56' }, false)).toEqual('-1,234.56')
      expect(numberFormatter(-5678.12, false)).toEqual('-5,678.12')
    })

    it('should format negative numbers with a minus sign by default', () => {
      expect(numberFormatter({ value: '-1234.56' })).toEqual('-1,234.56')
      expect(numberFormatter(-5678.12)).toEqual('-5,678.12')
    })

    it('should not affect positive numbers when useParentheses is true', () => {
      expect(numberFormatter({ value: '1234.56' }, true)).toEqual('1,234.56')
      expect(numberFormatter(5678.12, true)).toEqual('5,678.12')
    })

    it('should handle zero correctly with useParentheses option', () => {
      expect(numberFormatter({ value: '0' }, true)).toEqual('0')
      expect(numberFormatter(0, true)).toEqual('0')
    })

    it('should handle large negative numbers correctly with useParentheses option', () => {
      expect(numberFormatter({ value: '-1234567890.12' }, true)).toEqual(
        '(1,234,567,890.12)'
      )
      expect(numberFormatter(-9876543210.98, true)).toEqual(
        '(9,876,543,210.98)'
      )
    })
  })
})

describe('currencyFormatter', () => {
  it('should format numbers as CAD currency', () => {
    expect(currencyFormatter(1234.56)).toEqual('$1,234.56')
    expect(currencyFormatter({ value: 7890 })).toEqual('$7,890.00')
  })

  it('should return original value if not a number', () => {
    expect(currencyFormatter('abc')).toEqual('abc')
    expect(currencyFormatter(null)).toEqual(null)
  })

  it('should handle zero correctly', () => {
    expect(currencyFormatter(0)).toEqual('$0.00')
    expect(currencyFormatter({ value: 0 })).toEqual('$0.00')
  })

  it('should handle negative numbers correctly', () => {
    expect(currencyFormatter(-1234.56)).toEqual('-$1,234.56')
    expect(currencyFormatter({ value: -7890 })).toEqual('-$7,890.00')
  })

  it('should handle string numbers correctly', () => {
    expect(currencyFormatter('1234.56')).toEqual('$1,234.56')
    expect(currencyFormatter({ value: '7890' })).toEqual('$7,890.00')
  })

  it('should return original value for non-numeric strings', () => {
    expect(currencyFormatter('not a number')).toEqual('not a number')
  })

  it('should handle undefined input', () => {
    expect(currencyFormatter(undefined)).toEqual(undefined)
  })

  it('should handle empty object input', () => {
    expect(currencyFormatter({})).toEqual({})
  })

  it('should handle objects without value property', () => {
    expect(currencyFormatter({ amount: 100 })).toEqual({ amount: 100 })
  })

  it('should handle large numbers correctly', () => {
    expect(currencyFormatter(1234567890.12)).toEqual('$1,234,567,890.12')
  })

  it('should handle very small numbers correctly', () => {
    expect(currencyFormatter(0.0001)).toEqual('$0.00')
  })
})

describe('decimalFormatter', () => {
  it('should format numbers to two decimal places', () => {
    expect(decimalFormatter({ value: 1234 })).toEqual('1,234.00')
    expect(decimalFormatter({ value: 5678.9 })).toEqual('5,678.90')
  })

  it('should return original value if null', () => {
    expect(decimalFormatter({ value: null })).toEqual(null)
  })
})

describe('dateFormatter', () => {
  it('should format params values to YYYY-MM-DD', () => {
    expect(dateFormatter({ value: '2023-10-05T14:48:00.000Z' })).toEqual(
      '2023-10-05'
    )
  })

  it('should format date strings to YYYY-MM-DD', () => {
    expect(dateFormatter('2023-10-05T14:48:00.000Z')).toEqual('2023-10-05')
  })

  it('should return empty string if value is null', () => {
    expect(dateFormatter({ value: null })).toEqual('')
  })
})

describe('phoneNumberFormatter', () => {
  it('should format phone numbers correctly', () => {
    expect(phoneNumberFormatter({ value: '1234567890' })).toEqual(
      '(123) 456-7890'
    )
  })

  it('should return empty string if value is null', () => {
    expect(phoneNumberFormatter({ value: null })).toEqual('')
  })

  it('should handle phone numbers with non-digit characters', () => {
    expect(phoneNumberFormatter({ value: '(123) 456-7890' })).toEqual(
      '(123) 456-7890'
    )
    expect(phoneNumberFormatter({ value: '123-456-7890' })).toEqual(
      '(123) 456-7890'
    )
    expect(phoneNumberFormatter({ value: '123.456.7890' })).toEqual(
      '(123) 456-7890'
    )
  })

  it('should return empty string for non-numeric strings', () => {
    expect(phoneNumberFormatter({ value: 'abcdefg' })).toEqual('')
  })

  it('should handle undefined input', () => {
    expect(phoneNumberFormatter({ value: undefined })).toEqual('')
  })

  it('should handle empty string input', () => {
    expect(phoneNumberFormatter({ value: '' })).toEqual('')
  })

  it('should handle objects without value property', () => {
    expect(phoneNumberFormatter({})).toEqual('')
  })

  it('should handle numeric input directly', () => {
    expect(phoneNumberFormatter({ value: 1234567890 })).toEqual(
      '(123) 456-7890'
    )
  })
})

describe('convertObjectKeys', () => {
  it('should convert camelCase keys to snake_case', () => {
    const input = {
      camelCaseKey: 'value',
      nestedObject: { anotherKey: 'value' }
    }
    const expected = {
      camel_case_key: 'value',
      nested_object: { another_key: 'value' }
    }
    expect(convertObjectKeys(input)).toEqual(expected)
  })

  it('should handle arrays correctly', () => {
    const input = [{ camelCaseKey: 'value' }]
    const expected = [{ camel_case_key: 'value' }]
    expect(convertObjectKeys(input)).toEqual(expected)
  })
})

describe('calculateTotalValue', () => {
  it('should calculate total value correctly', () => {
    expect(calculateTotalValue('10', '5')).toEqual(50)
    expect(calculateTotalValue('2.5', '4')).toEqual(10)
  })

  it('should return 0 for invalid inputs', () => {
    expect(calculateTotalValue('abc', '5')).toEqual(0)
    expect(calculateTotalValue('10', 'xyz')).toEqual(0)
  })
})

describe('isNumeric', () => {
  it('should return true for numeric strings', () => {
    expect(isNumeric('123')).toEqual(true)
    expect(isNumeric('123.45')).toEqual(true)
  })

  it('should return false for non-numeric strings', () => {
    expect(isNumeric('abc')).toEqual(false)
    expect(isNumeric('123abc')).toEqual(false)
  })
})

describe('calculateRowHeight', () => {
  it('should calculate row height based on roles and width', () => {
    const rolesArray = [{ name: roles.administrator }, { name: roles.analyst }]
    expect(calculateRowHeight(100, rolesArray)).toEqual(84) // 42 * 2 rows
  })

  it('should handle a single role that fits within the width', () => {
    const rolesArray = [{ name: roles.transfers }]
    expect(calculateRowHeight(200, rolesArray)).toEqual(42) // 1 row
  })

  it('should handle multiple roles that fit within the width', () => {
    const rolesArray = [{ name: roles.transfers }, { name: roles.analyst }]
    expect(calculateRowHeight(200, rolesArray)).toEqual(42) // 1 row
  })

  it('should handle multiple roles that require multiple rows', () => {
    const rolesArray = [
      { name: roles.signing_authority },
      { name: roles.compliance_reporting },
      { name: roles.manage_users }
    ]
    expect(calculateRowHeight(200, rolesArray)).toEqual(126) // 42 * 3 rows
  })

  it('should handle roles with zero width', () => {
    const rolesArray = [{ name: roles.supplier }, { name: roles.government }]
    expect(calculateRowHeight(100, rolesArray)).toEqual(42) // 1 row
  })

  it('should handle an empty roles array', () => {
    const rolesArray = []
    expect(calculateRowHeight(100, rolesArray)).toEqual(42) // 1 row (default)
  })

  it('should handle roles with undefined sizes', () => {
    const rolesArray = [{ name: 'Unknown Role' }]
    expect(calculateRowHeight(100, rolesArray)).toEqual(42) // 1 row (default)
  })

  it('should handle roles with mixed known and unknown sizes', () => {
    const rolesArray = [{ name: roles.administrator }, { name: 'Unknown Role' }]
    expect(calculateRowHeight(200, rolesArray)).toEqual(42) // 1 row
  })

  it('should handle roles that exactly fill the width', () => {
    const rolesArray = [
      { name: roles.signing_authority },
      { name: roles.director }
    ]
    expect(calculateRowHeight(219, rolesArray)).toEqual(42) // 1 row
  })
})

describe('timezoneFormatter', () => {
  it('should format date with timezone', () => {
    const date = new Date('2023-10-05T14:48:00.000Z')
    expect(timezoneFormatter({ value: date })).toEqual('2023-10-05 7:48 am PDT')
  })
})

describe('spacesFormatter', () => {
  it('should add spaces before capital letters', () => {
    expect(spacesFormatter({ value: 'CamelCaseString' })).toEqual(
      'Camel Case String'
    )
  })

  it('should return original value if null', () => {
    expect(spacesFormatter({ value: null })).toEqual(null)
  })
})

describe('cleanEmptyStringValues', () => {
  it('should remove keys with empty string values', () => {
    const input = { key1: 'value', key2: '', key3: null }
    const expected = { key1: 'value' }
    expect(cleanEmptyStringValues(input)).toEqual(expected)
  })
})

describe('formatNumberWithCommas', () => {
  it('should format numbers with commas', () => {
    expect(formatNumberWithCommas({ value: '1234567.89' })).toEqual(
      '1,234,567.89'
    )
  })

  it('should return 0 for null or undefined values', () => {
    expect(formatNumberWithCommas({ value: null })).toEqual(0)
  })
})

describe('formatNumberWithoutCommas', () => {
  it('should remove commas from numbers', () => {
    expect(formatNumberWithoutCommas('1,234,567.89')).toEqual(1234567.89)
  })

  it('should return undefined for invalid numbers', () => {
    expect(formatNumberWithoutCommas('abc')).toEqual(undefined)
  })
})

describe('dateToLongString', () => {
  it('should format a date string to a long string format', () => {
    expect(dateToLongString('2024-01-01')).toBe('January 1, 2024')
    expect(dateToLongString('2025-12-31')).toBe('December 31, 2025')
  })

  it('should handle different valid date strings', () => {
    expect(dateToLongString('2023-02-28T10:00:00Z')).toBe('February 28, 2023')
  })

  it('should return an empty string for invalid or empty input', () => {
    expect(dateToLongString(null)).toBe('')
    expect(dateToLongString(undefined)).toBe('')
    expect(dateToLongString('')).toBe('')
    expect(dateToLongString('not a date')).toBe('Invalid Date')
  })
})
