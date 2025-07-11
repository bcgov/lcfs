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

describe('formatFuelCodeWithCountryPrefix', () => {
  describe('2025 and forward compliance periods', () => {
    it('should add C- prefix for Canadian fuel codes in 2025', () => {
      expect(
        formatFuelCodeWithCountryPrefix('BCLCF101.1', 'Canada', 2025)
      ).toBe('C-BCLCF101.1')
      expect(
        formatFuelCodeWithCountryPrefix('BCLCF101.1', 'canada', 2025)
      ).toBe('C-BCLCF101.1')
      expect(formatFuelCodeWithCountryPrefix('FC123', 'CANADA', 2025)).toBe(
        'C-FC123'
      )
    })

    it('should add C- prefix for Canadian fuel codes in years after 2025', () => {
      expect(
        formatFuelCodeWithCountryPrefix('BCLCF101.1', 'Canada', 2026)
      ).toBe('C-BCLCF101.1')
      expect(formatFuelCodeWithCountryPrefix('FC123', 'Canada', 2030)).toBe(
        'C-FC123'
      )
      expect(formatFuelCodeWithCountryPrefix('TEST', 'Canada', '2027')).toBe(
        'C-TEST'
      )
    })

    it('should not add prefix for non-Canadian countries in 2025+', () => {
      expect(
        formatFuelCodeWithCountryPrefix('BCLCF101.1', 'United States', 2025)
      ).toBe('BCLCF101.1')
      expect(formatFuelCodeWithCountryPrefix('FC123', 'USA', 2025)).toBe(
        'FC123'
      )
      expect(formatFuelCodeWithCountryPrefix('TEST', 'Mexico', 2026)).toBe(
        'TEST'
      )
      expect(formatFuelCodeWithCountryPrefix('CODE', null, 2025)).toBe('CODE')
      expect(formatFuelCodeWithCountryPrefix('CODE', undefined, 2025)).toBe(
        'CODE'
      )
    })

    it('should handle string compliance periods correctly', () => {
      expect(formatFuelCodeWithCountryPrefix('FC123', 'Canada', '2025')).toBe(
        'C-FC123'
      )
      expect(formatFuelCodeWithCountryPrefix('FC123', 'Canada', '2026')).toBe(
        'C-FC123'
      )
    })
  })

  describe('Pre-2025 compliance periods', () => {
    it('should not add prefix for any country before 2025', () => {
      expect(
        formatFuelCodeWithCountryPrefix('BCLCF101.1', 'Canada', 2024)
      ).toBe('BCLCF101.1')
      expect(formatFuelCodeWithCountryPrefix('FC123', 'Canada', 2023)).toBe(
        'FC123'
      )
      expect(formatFuelCodeWithCountryPrefix('TEST', 'Canada', 2022)).toBe(
        'TEST'
      )
      expect(formatFuelCodeWithCountryPrefix('CODE', 'Canada', '2024')).toBe(
        'CODE'
      )
    })

    it('should not add prefix for non-Canadian countries before 2025', () => {
      expect(
        formatFuelCodeWithCountryPrefix('BCLCF101.1', 'United States', 2024)
      ).toBe('BCLCF101.1')
      expect(formatFuelCodeWithCountryPrefix('FC123', 'USA', 2023)).toBe(
        'FC123'
      )
    })
  })

  describe('Edge cases', () => {
    it('should return original value for null or undefined fuel codes', () => {
      expect(formatFuelCodeWithCountryPrefix(null, 'Canada', 2025)).toBe(null)
      expect(formatFuelCodeWithCountryPrefix(undefined, 'Canada', 2025)).toBe(
        undefined
      )
      expect(formatFuelCodeWithCountryPrefix('', 'Canada', 2025)).toBe('')
    })

    it('should handle invalid compliance periods', () => {
      expect(
        formatFuelCodeWithCountryPrefix('FC123', 'Canada', 'invalid')
      ).toBe('FC123')
      expect(formatFuelCodeWithCountryPrefix('FC123', 'Canada', null)).toBe(
        'FC123'
      )
      expect(
        formatFuelCodeWithCountryPrefix('FC123', 'Canada', undefined)
      ).toBe('FC123')
      expect(formatFuelCodeWithCountryPrefix('FC123', 'Canada', NaN)).toBe(
        'FC123'
      )
    })

    it('should handle numeric compliance periods with decimals', () => {
      expect(formatFuelCodeWithCountryPrefix('FC123', 'Canada', 2025.5)).toBe(
        'C-FC123'
      )
      expect(formatFuelCodeWithCountryPrefix('FC123', 'Canada', 2024.9)).toBe(
        'FC123'
      )
    })
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

describe('formatFuelCodeOptions', () => {
  const mockFuelCodes2025 = [
    {
      fuelCode: 'BCLCF101.1',
      fuelProductionFacilityCountry: 'Canada'
    },
    {
      fuelCode: 'BCLCF102.1',
      fuelProductionFacilityCountry: 'United States'
    },
    {
      fuelCode: 'BCLCF103.1',
      fuelProductionFacilityCountry: 'Canada'
    },
    {
      fuelCode: 'BCLCF104.1',
      fuelProductionFacilityCountry: null
    }
  ]

  const mockFuelCodesSnakeCase = [
    {
      fuel_code: 'BCLCF201.1',
      fuel_production_facility_country: 'Canada'
    },
    {
      fuel_code: 'BCLCF202.1',
      fuel_production_facility_country: 'United States'
    }
  ]

  const mockFuelCodesMixed = [
    {
      fuelCode: 'BCLCF301.1',
      fuel_production_facility_country: 'Canada'
    },
    {
      fuel_code: 'BCLCF302.1',
      fuelProductionFacilityCountry: 'Canada'
    }
  ]

  describe('2025 and forward compliance periods', () => {
    it('should format Canadian fuel codes with C- prefix', () => {
      const result = formatFuelCodeOptions(mockFuelCodes2025, 2025)
      expect(result).toEqual([
        'C-BCLCF101.1',
        'BCLCF102.1',
        'C-BCLCF103.1',
        'BCLCF104.1'
      ])
    })

    it('should handle snake_case field names', () => {
      const result = formatFuelCodeOptions(mockFuelCodesSnakeCase, 2025)
      expect(result).toEqual(['C-BCLCF201.1', 'BCLCF202.1'])
    })

    it('should handle mixed field naming conventions', () => {
      const result = formatFuelCodeOptions(mockFuelCodesMixed, 2025)
      expect(result).toEqual(['C-BCLCF301.1', 'C-BCLCF302.1'])
    })

    it('should work with string compliance periods', () => {
      const result = formatFuelCodeOptions(mockFuelCodes2025, '2025')
      expect(result).toEqual([
        'C-BCLCF101.1',
        'BCLCF102.1',
        'C-BCLCF103.1',
        'BCLCF104.1'
      ])
    })
  })

  describe('Pre-2025 compliance periods', () => {
    it('should not add prefixes for 2024 and earlier', () => {
      const result = formatFuelCodeOptions(mockFuelCodes2025, 2024)
      expect(result).toEqual([
        'BCLCF101.1',
        'BCLCF102.1',
        'BCLCF103.1',
        'BCLCF104.1'
      ])
    })
  })

  describe('Edge cases', () => {
    it('should return empty array for null or undefined input', () => {
      expect(formatFuelCodeOptions(null, 2025)).toEqual([])
      expect(formatFuelCodeOptions(undefined, 2025)).toEqual([])
    })

    it('should return empty array for non-array input', () => {
      expect(formatFuelCodeOptions('not an array', 2025)).toEqual([])
      expect(formatFuelCodeOptions({}, 2025)).toEqual([])
      expect(formatFuelCodeOptions(123, 2025)).toEqual([])
    })

    it('should handle empty array', () => {
      expect(formatFuelCodeOptions([], 2025)).toEqual([])
    })

    it('should handle items with missing fuel codes', () => {
      const fuelCodesWithMissing = [
        {
          fuelCode: 'BCLCF101.1',
          fuelProductionFacilityCountry: 'Canada'
        },
        {
          fuelProductionFacilityCountry: 'Canada'
        },
        {
          fuelCode: null,
          fuelProductionFacilityCountry: 'Canada'
        },
        {
          fuelCode: 'BCLCF102.1',
          fuelProductionFacilityCountry: 'United States'
        }
      ]

      const result = formatFuelCodeOptions(fuelCodesWithMissing, 2025)
      expect(result).toEqual([
        'C-BCLCF101.1',
        undefined,
        undefined,
        'BCLCF102.1'
      ])
    })

    it('should handle invalid compliance periods', () => {
      const result = formatFuelCodeOptions(mockFuelCodes2025, 'invalid')
      expect(result).toEqual([
        'BCLCF101.1',
        'BCLCF102.1',
        'BCLCF103.1',
        'BCLCF104.1'
      ])
    })
  })
})
