import { describe, it, expect, vi } from 'vite-plus/test'
import { fuelExportColDefs } from '../_schema'
import type { OptionsData } from '@/types/schema'
import type { ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'

vi.mock('@/components/BCDataGrid/components', () => ({
  AsyncSuggestionEditor: () => null,
  AutocompleteCellEditor: () => null,
  DateEditor: () => null,
  NumberEditor: () => null,
  RequiredHeader: () => null,
  ActionsRenderer: () => null,
  ValidationRenderer2: () => null
}))

describe('FuelExports Schema', () => {
  describe('Column Definitions', () => {
    const mockOptionsData: OptionsData = {
      fuelTypes: [
        {
          fuelType: 'Test Fuel',
          fuelTypeId: 1,
          unit: 'L',
          defaultCarbonIntensity: 0,
          fuelCategories: [],
          fuelCodes: [],
          provisions: [],
          eerRatios: []
        }
      ]
    }
    const columns = fuelExportColDefs(mockOptionsData, {}, {}, true, false)
    const getColumn = (field: string) => {
      const colDef = columns.find((col) => col.field === field)
      if (!colDef) throw new Error(`Expected ${field} column definition`)
      return colDef
    }

    it.each([
      'complianceUnits',
      'fuelTypeId',
      'fuelCategory',
      'fuelCode',
      'ciOfFuel',
      'uci',
      'energyDensity',
      'eer',
      'energy'
    ])('should apply changelog style to %s', (field) => {
      expect(getColumn(field).cellStyle).toBeDefined()
    })

    it('should round CNG energy content for display and preserve other fuel decimals', () => {
      const formatter = getColumn('energy').valueFormatter
      if (typeof formatter !== 'function') {
        throw new Error('Expected energy value formatter')
      }
      expect(
        formatter({
          value: 1234.56,
          data: { fuelType: 'CNG', fuelCategory: 'Gasoline' }
        } as ValueFormatterParams)
      ).toBe('1,235')
      expect(
        formatter({
          value: 1234.56,
          data: { fuelType: 'Test Fuel', fuelCategory: 'Diesel' }
        } as ValueFormatterParams)
      ).toBe('1,234.56')
    })

    it('should format numbers with commas', () => {
      const formatter = getColumn('complianceUnits').valueFormatter
      if (typeof formatter !== 'function') {
        throw new Error('Expected compliance units value formatter')
      }
      expect(formatter({ value: 1000 } as ValueFormatterParams)).toBe('1,000')
    })

    it('should get value from nested object', () => {
      const getter = getColumn('fuelTypeId').valueGetter
      if (typeof getter !== 'function') {
        throw new Error('Expected fuel type value getter')
      }
      expect(
        getter({ data: { fuelType: 'Test Fuel' } } as ValueGetterParams)
      ).toBe('Test Fuel')
    })
  })
})
