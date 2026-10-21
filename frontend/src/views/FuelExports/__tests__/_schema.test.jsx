import { describe, it, expect, vi } from 'vitest'
import { fuelExportColDefs } from '../_schema'

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
    const mockOptionsData = {
      fuelTypes: [
        {
          fuelType: 'Test Fuel',
          fuelTypeId: 1,
          fuelCategories: [
            {
              fuelCategory: 'Test Category',
              fuelCategoryId: 1
            }
          ]
        }
      ]
    }
    const mockErrors = {}
    const mockWarnings = {}
    const mockGridReady = true
    const mockIsSupplemental = false

    const columns = fuelExportColDefs(
      mockOptionsData,
      mockErrors,
      mockWarnings,
      mockGridReady,
      mockIsSupplemental
    )

    it('should apply changelog style to compliance units', () => {
      const colDef = columns.find((col) => col.field === 'complianceUnits')
      expect(colDef).toBeDefined()
      expect(colDef.cellStyle).toBeDefined()
    })

    it('should apply changelog style to fuel type', () => {
      const colDef = columns.find((col) => col.field === 'fuelTypeId')
      expect(colDef).toBeDefined()
      expect(colDef.cellStyle).toBeDefined()
    })

    it('should apply changelog style to fuel category', () => {
      const colDef = columns.find((col) => col.field === 'fuelCategory')
      expect(colDef).toBeDefined()
      expect(colDef.cellStyle).toBeDefined()
    })

    it('should apply changelog style to fuel code', () => {
      const colDef = columns.find((col) => col.field === 'fuelCode')
      expect(colDef).toBeDefined()
      expect(colDef.cellStyle).toBeDefined()
    })

    it('should apply changelog style to ciOfFuel', () => {
      const colDef = columns.find((col) => col.field === 'ciOfFuel')
      expect(colDef).toBeDefined()
      expect(colDef.cellStyle).toBeDefined()
    })

    it('should apply changelog style to uci', () => {
      const colDef = columns.find((col) => col.field === 'uci')
      expect(colDef).toBeDefined()
      expect(colDef.cellStyle).toBeDefined()
    })

    it('should apply changelog style to energyDensity', () => {
      const colDef = columns.find((col) => col.field === 'energyDensity')
      expect(colDef).toBeDefined()
      expect(colDef.cellStyle).toBeDefined()
    })

    it('should apply changelog style to eer', () => {
      const colDef = columns.find((col) => col.field === 'eer')
      expect(colDef).toBeDefined()
      expect(colDef.cellStyle).toBeDefined()
    })

    it('should apply changelog style to energy', () => {
      const colDef = columns.find((col) => col.field === 'energy')
      expect(colDef).toBeDefined()
      expect(colDef.cellStyle).toBeDefined()
    })

    it('should round CNG energy content for display and preserve other fuel decimals', () => {
      const colDef = columns.find((col) => col.field === 'energy')

      expect(
        colDef.valueFormatter({
          value: 1234.56,
          data: { fuelType: 'CNG', fuelCategory: 'Gasoline' }
        })
      ).toBe('1,235')
      expect(
        colDef.valueFormatter({
          value: 1234.56,
          data: { fuelType: 'Test Fuel', fuelCategory: 'Diesel' }
        })
      ).toBe('1,234.56')
    })

    it('should format numbers with commas', () => {
      const colDef = columns.find((col) => col.field === 'complianceUnits')
      expect(colDef).toBeDefined()
      expect(colDef.valueFormatter).toBeDefined()
      expect(colDef.valueFormatter({ value: 1000 })).toBe('1,000')
    })

    it('should get value from nested object', () => {
      const colDef = columns.find((col) => col.field === 'fuelTypeId')
      expect(colDef).toBeDefined()
      expect(colDef.valueGetter).toBeDefined()
      expect(colDef.valueGetter({ data: { fuelType: 'Test Fuel' } })).toBe(
        'Test Fuel'
      )
    })
  })
})
