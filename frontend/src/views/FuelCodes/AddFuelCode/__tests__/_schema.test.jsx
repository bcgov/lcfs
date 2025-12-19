import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fuelCodeColDefs } from '../_schema'

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('@/i18n', () => ({
  default: { t: (key) => key }
}))

vi.mock('@/constants/routes', () => ({
  apiRoutes: { fuelCodeSearch: '/api/fuel-codes/search?' }
}))

vi.mock('@/components/BCDataGrid/components', () => ({
  AsyncSuggestionEditor: () => null,
  AutocompleteCellEditor: () => null,
  DateEditor: () => null,
  NumberEditor: () => null,
  RequiredHeader: () => null
}))

vi.mock('@/utils/grid/eventHandlers', () => ({
  suppressKeyboardEvent: vi.fn()
}))

vi.mock('@/utils/grid/cellRenderers', () => ({
  CommonArrayRenderer: () => null
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children }) => children
}))

vi.mock('@/components/BCDataGrid/columns', () => ({
  actions: () => ({}),
  validation: {}
}))

vi.mock('@/utils/formatters', () => ({
  numberFormatter: (params) => params.value
}))

describe('fuelCodeColDefs', () => {
  const mockOptionsData = {
    fuelCodePrefixes: [
      { fuelCodePrefixId: 1, prefix: 'BCLCF', nextFuelCode: '100.0' },
      { fuelCodePrefixId: 2, prefix: 'PROXY', nextFuelCode: '200.0' },
      { fuelCodePrefixId: 3, prefix: 'C-BCLCF', nextFuelCode: '300.0' },
      { fuelCodePrefixId: 4, prefix: 'C-PROXY', nextFuelCode: '400.0' }
    ],
    fuelTypes: [{ fuelTypeId: 1, fuelType: 'Diesel' }],
    transportModes: [{ transportModeId: 1, transportMode: 'Truck' }],
    fieldOptions: {
      feedstock: ['Corn', 'Soy'],
      feedstockLocation: ['BC', 'AB'],
      feedstockMisc: ['Misc1'],
      company: ['Company A'],
      contactName: ['John Doe'],
      contactEmail: ['john@example.com'],
      formerCompany: ['Old Company']
    },
    facilityNameplateCapacityUnits: ['L/year', 'kg/year']
  }

  let columnDefs

  beforeEach(() => {
    columnDefs = fuelCodeColDefs(mockOptionsData, {}, true, true, false, true)
  })

  describe('fuelProductionFacilityCountry field', () => {
    let countryColumn

    beforeEach(() => {
      countryColumn = columnDefs.find(
        (col) => col.field === 'fuelProductionFacilityCountry'
      )
    })

    it('should have a valueSetter defined', () => {
      expect(countryColumn).toBeDefined()
      expect(countryColumn.valueSetter).toBeDefined()
      expect(typeof countryColumn.valueSetter).toBe('function')
    })

    describe('valueSetter - BCLCF prefix behavior', () => {
      it('should change BCLCF to C-BCLCF when country is set to Canada', () => {
        const params = {
          newValue: 'Canada',
          data: {
            prefix: 'BCLCF',
            prefixId: 1,
            fuelSuffix: '100.0'
          }
        }

        const result = countryColumn.valueSetter(params)

        expect(result).toBe(true)
        expect(params.data.fuelProductionFacilityCountry).toBe('Canada')
        expect(params.data.prefix).toBe('C-BCLCF')
        expect(params.data.prefixId).toBe(3)
        expect(params.data.fuelCodePrefixId).toBe(3)
        expect(params.data.fuelSuffix).toBe('300.0')
      })

      it('should change BCLCF to C-BCLCF with case-insensitive Canada match', () => {
        const params = {
          newValue: 'CANADA',
          data: {
            prefix: 'BCLCF',
            prefixId: 1,
            fuelSuffix: '100.0'
          }
        }

        countryColumn.valueSetter(params)

        expect(params.data.prefix).toBe('C-BCLCF')
      })

      it('should change BCLCF to C-BCLCF with trimmed Canada value', () => {
        const params = {
          newValue: '  Canada  ',
          data: {
            prefix: 'BCLCF',
            prefixId: 1,
            fuelSuffix: '100.0'
          }
        }

        countryColumn.valueSetter(params)

        expect(params.data.fuelProductionFacilityCountry).toBe('Canada')
        expect(params.data.prefix).toBe('C-BCLCF')
      })
    })

    describe('valueSetter - C-BCLCF prefix behavior', () => {
      it('should change C-BCLCF back to BCLCF when country is not Canada', () => {
        const params = {
          newValue: 'United States',
          data: {
            prefix: 'C-BCLCF',
            prefixId: 3,
            fuelSuffix: '300.0'
          }
        }

        const result = countryColumn.valueSetter(params)

        expect(result).toBe(true)
        expect(params.data.fuelProductionFacilityCountry).toBe('United States')
        expect(params.data.prefix).toBe('BCLCF')
        expect(params.data.prefixId).toBe(1)
        expect(params.data.fuelCodePrefixId).toBe(1)
        expect(params.data.fuelSuffix).toBe('100.0')
      })

      it('should change C-BCLCF back to BCLCF when country is cleared', () => {
        const params = {
          newValue: '',
          data: {
            prefix: 'C-BCLCF',
            prefixId: 3,
            fuelSuffix: '300.0'
          }
        }

        countryColumn.valueSetter(params)

        expect(params.data.prefix).toBe('BCLCF')
        expect(params.data.prefixId).toBe(1)
      })

      it('should keep C-BCLCF when country remains Canada', () => {
        const params = {
          newValue: 'Canada',
          data: {
            prefix: 'C-BCLCF',
            prefixId: 3,
            fuelSuffix: '300.0'
          }
        }

        countryColumn.valueSetter(params)

        expect(params.data.prefix).toBe('C-BCLCF')
        expect(params.data.prefixId).toBe(3)
      })
    })

    describe('valueSetter - PROXY prefix behavior (should never change)', () => {
      it('should NOT change PROXY prefix when country is set to Canada', () => {
        const params = {
          newValue: 'Canada',
          data: {
            prefix: 'PROXY',
            prefixId: 2,
            fuelSuffix: '200.0'
          }
        }

        const result = countryColumn.valueSetter(params)

        expect(result).toBe(true)
        expect(params.data.fuelProductionFacilityCountry).toBe('Canada')
        expect(params.data.prefix).toBe('PROXY')
        expect(params.data.prefixId).toBe(2)
        expect(params.data.fuelSuffix).toBe('200.0')
      })

      it('should NOT change PROXY prefix when country is set to any value', () => {
        const params = {
          newValue: 'United States',
          data: {
            prefix: 'PROXY',
            prefixId: 2,
            fuelSuffix: '200.0'
          }
        }

        countryColumn.valueSetter(params)

        expect(params.data.prefix).toBe('PROXY')
        expect(params.data.prefixId).toBe(2)
      })
    })

    describe('valueSetter - C-PROXY prefix behavior (should never change)', () => {
      it('should NOT change C-PROXY prefix when country is set to Canada', () => {
        const params = {
          newValue: 'Canada',
          data: {
            prefix: 'C-PROXY',
            prefixId: 4,
            fuelSuffix: '400.0'
          }
        }

        const result = countryColumn.valueSetter(params)

        expect(result).toBe(true)
        expect(params.data.fuelProductionFacilityCountry).toBe('Canada')
        expect(params.data.prefix).toBe('C-PROXY')
        expect(params.data.prefixId).toBe(4)
      })

      it('should NOT change C-PROXY prefix when country is not Canada', () => {
        const params = {
          newValue: 'Mexico',
          data: {
            prefix: 'C-PROXY',
            prefixId: 4,
            fuelSuffix: '400.0'
          }
        }

        countryColumn.valueSetter(params)

        expect(params.data.prefix).toBe('C-PROXY')
        expect(params.data.prefixId).toBe(4)
      })
    })

    describe('valueSetter - edge cases', () => {
      it('should handle null newValue', () => {
        const params = {
          newValue: null,
          data: {
            prefix: 'BCLCF',
            prefixId: 1,
            fuelSuffix: '100.0'
          }
        }

        const result = countryColumn.valueSetter(params)

        expect(result).toBe(true)
        expect(params.data.fuelProductionFacilityCountry).toBe('')
        expect(params.data.prefix).toBe('BCLCF')
      })

      it('should handle undefined newValue', () => {
        const params = {
          newValue: undefined,
          data: {
            prefix: 'BCLCF',
            prefixId: 1,
            fuelSuffix: '100.0'
          }
        }

        const result = countryColumn.valueSetter(params)

        expect(result).toBe(true)
        expect(params.data.fuelProductionFacilityCountry).toBe('')
      })

      it('should not change prefix if C-BCLCF prefix not found in options', () => {
        // Create columnDefs without C-BCLCF in options
        const limitedOptions = {
          ...mockOptionsData,
          fuelCodePrefixes: [
            { fuelCodePrefixId: 1, prefix: 'BCLCF', nextFuelCode: '100.0' },
            { fuelCodePrefixId: 2, prefix: 'PROXY', nextFuelCode: '200.0' }
          ]
        }
        const limitedColumnDefs = fuelCodeColDefs(
          limitedOptions,
          {},
          true,
          true,
          false,
          true
        )
        const limitedCountryColumn = limitedColumnDefs.find(
          (col) => col.field === 'fuelProductionFacilityCountry'
        )

        const params = {
          newValue: 'Canada',
          data: {
            prefix: 'BCLCF',
            prefixId: 1,
            fuelSuffix: '100.0'
          }
        }

        limitedCountryColumn.valueSetter(params)

        // Prefix should remain unchanged since C-BCLCF wasn't found
        expect(params.data.prefix).toBe('BCLCF')
      })
    })
  })

  describe('prefix field', () => {
    let prefixColumn

    beforeEach(() => {
      prefixColumn = columnDefs.find((col) => col.field === 'prefix')
    })

    it('should have a valueSetter that sets country to Canada for C-BCLCF', () => {
      const params = {
        newValue: 'C-BCLCF',
        oldValue: 'BCLCF',
        data: {
          prefix: 'BCLCF',
          prefixId: 1
        }
      }

      prefixColumn.valueSetter(params)

      expect(params.data.prefix).toBe('C-BCLCF')
      expect(params.data.fuelProductionFacilityCountry).toBe('Canada')
    })

    it('should NOT set country for PROXY prefix', () => {
      const params = {
        newValue: 'PROXY',
        oldValue: 'BCLCF',
        data: {
          prefix: 'BCLCF',
          prefixId: 1,
          fuelProductionFacilityCountry: 'United States'
        }
      }

      prefixColumn.valueSetter(params)

      expect(params.data.prefix).toBe('PROXY')
      // Country should remain unchanged
      expect(params.data.fuelProductionFacilityCountry).toBe('United States')
    })
  })

  describe('country field editability', () => {
    let countryColumn

    beforeEach(() => {
      countryColumn = columnDefs.find(
        (col) => col.field === 'fuelProductionFacilityCountry'
      )
    })

    it('should not be editable when prefix is C-BCLCF', () => {
      const params = {
        data: { prefix: 'C-BCLCF' }
      }

      expect(countryColumn.editable(params)).toBe(false)
    })

    it('should be editable when prefix is BCLCF', () => {
      const params = {
        data: { prefix: 'BCLCF' }
      }

      expect(countryColumn.editable(params)).toBe(true)
    })

    it('should be editable when prefix is PROXY', () => {
      const params = {
        data: { prefix: 'PROXY' }
      }

      expect(countryColumn.editable(params)).toBe(true)
    })

    it('should be editable when prefix is C-PROXY', () => {
      const params = {
        data: { prefix: 'C-PROXY' }
      }

      expect(countryColumn.editable(params)).toBe(true)
    })
  })

  describe('country field tooltip', () => {
    let countryColumn

    beforeEach(() => {
      countryColumn = columnDefs.find(
        (col) => col.field === 'fuelProductionFacilityCountry'
      )
    })

    it('should show tooltip for C-BCLCF prefix', () => {
      const params = {
        data: { prefix: 'C-BCLCF' }
      }

      expect(countryColumn.tooltipValueGetter(params)).toBe(
        'Cannot change country for C-BCLCF fuel codes'
      )
    })

    it('should not show tooltip for other prefixes', () => {
      const params = {
        data: { prefix: 'PROXY' }
      }

      expect(countryColumn.tooltipValueGetter(params)).toBe('')
    })
  })
})
