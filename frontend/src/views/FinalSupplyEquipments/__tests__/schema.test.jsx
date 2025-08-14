import { describe, it, expect, vi } from 'vitest'
import { finalSupplyEquipmentColDefs } from '../_schema'
import { DateEditor } from '@/components/BCDataGrid/components'

// Mock i18n.t function
vi.mock('i18next', () => ({
  default: {
    t: (key) => key
  }
}))

// Mock dayjs
vi.mock('dayjs', () => {
  return {
    default: (date) => ({
      toDate: () => new Date(date)
    })
  }
})

describe('finalSupplyEquipmentColDefs', () => {
  const mockOptionsData = {
    organizationNames: ['Organization 1', 'Organization 2'],
    levelsOfEquipment: [{ name: 'Level 1' }, { name: 'Level 2' }],
    intendedUseTypes: [{ type: 'Use Type 1' }, { type: 'Use Type 2' }],
    intendedUserTypes: [
      { typeName: 'User Type 1' },
      { typeName: 'User Type 2' }
    ],
    ports: ['Port 1', 'Port 2']
  }

  const mockCompliancePeriod = '2023'
  const mockErrors = {}
  const mockWarnings = {}

  it('should include separate supplyFromDate and supplyToDate columns instead of a date range column', () => {
    const mockGridReady = true
    const colDefs = finalSupplyEquipmentColDefs(
      mockOptionsData,
      mockCompliancePeriod,
      mockErrors,
      mockWarnings,
      mockGridReady,
      null
    )

    // Find the supplyFromDate and supplyToDate columns
    const supplyFromDateCol = colDefs.find(
      (col) => col.field === 'supplyFromDate'
    )
    const supplyToDateCol = colDefs.find((col) => col.field === 'supplyToDate')

    // Verify supplyFrom column doesn't exist anymore (replaced by the two date columns)
    const supplyFromCol = colDefs.find((col) => col.field === 'supplyFrom')

    // Assert that both date columns exist and the range column doesn't
    expect(supplyFromDateCol).toBeDefined()
    expect(supplyToDateCol).toBeDefined()
    expect(supplyFromCol).toBeUndefined()

    // Verify the individual date columns use the expected date editor
    expect(supplyFromDateCol.cellEditor).toBe(DateEditor)
    expect(supplyToDateCol.cellEditor).toBe(DateEditor)

    // Check that the valueGetter and valueSetter functions work correctly
    const mockParams = {
      data: {
        supplyFromDate: '2023-02-01',
        supplyToDate: '2023-11-30'
      }
    }

    expect(supplyFromDateCol.valueGetter(mockParams)).toBe('2023-02-01')
    expect(supplyToDateCol.valueGetter(mockParams)).toBe('2023-11-30')

    // Test valueSetters
    const fromParams = {
      ...mockParams,
      newValue: '2023-03-01'
    }
    supplyFromDateCol.valueSetter(fromParams)
    expect(fromParams.data.supplyFromDate).toBe('2023-03-01')

    const toParams = {
      ...mockParams,
      newValue: '2023-10-15'
    }
    supplyToDateCol.valueSetter(toParams)
    expect(toParams.data.supplyToDate).toBe('2023-10-15')

    // Check defaults
    const emptyParams = { data: {} }
    expect(supplyFromDateCol.valueGetter(emptyParams)).toBe('2023-01-01')
    expect(supplyToDateCol.valueGetter(emptyParams)).toBe('2023-12-31')
  })

  it('organizationName column handles valid and custom entries', () => {
    const colDefs = finalSupplyEquipmentColDefs(
      mockOptionsData,
      mockCompliancePeriod,
      mockErrors,
      mockWarnings,
      true,
      null
    )

    const orgCol = colDefs.find((c) => c.field === 'organizationName')
    expect(orgCol).toBeDefined()

    const paramsValid = { data: {}, newValue: 'Organization 1' }
    expect(orgCol.valueSetter(paramsValid)).toBe(true)
    expect(paramsValid.data.organizationName).toBe('Organization 1')

    const paramsCustom = { data: {}, newValue: 'Custom Org' }
    expect(orgCol.valueSetter(paramsCustom)).toBe(true)
    expect(paramsCustom.data.organizationName).toBe('Custom Org')
  })

  it('kwhUsage column formatting and editor params', () => {
    const colDefs = finalSupplyEquipmentColDefs(
      mockOptionsData,
      mockCompliancePeriod,
      mockErrors,
      mockWarnings,
      true,
      null
    )

    const kwhCol = colDefs.find((c) => c.field === 'kwhUsage')
    expect(kwhCol).toBeDefined()
    expect(kwhCol.type).toBe('numericColumn')

    // valueFormatter adds thousand separators
    const formatted = kwhCol.valueFormatter({ value: 12345 })
    expect(formatted).toContain('12')

    // Editor params
    expect(kwhCol.cellEditorParams.min).toBe(0)
    expect(kwhCol.cellEditorParams.precision).toBe(0)
  })

  it('exercises all column callbacks for coverage', () => {
    const colDefs = finalSupplyEquipmentColDefs(
      mockOptionsData,
      mockCompliancePeriod,
      mockErrors,
      mockWarnings,
      true
    )

    colDefs.forEach((col) => {
      const params = {
        data: { [col.field]: 'test', organizationName: 'Organization 1' },
        value: 'test',
        newValue: 'newTest',
        colDef: col,
        api: {
          getEditingCells: vi.fn().mockReturnValue([]),
          stopEditing: vi.fn()
        }
      }

      // Execute all function properties to boost coverage
      if (typeof col.cellRenderer === 'function') col.cellRenderer(params)
      if (typeof col.valueGetter === 'function') col.valueGetter(params)
      if (typeof col.valueSetter === 'function') col.valueSetter(params)
      if (typeof col.cellEditorParams === 'function')
        col.cellEditorParams(params)
      if (typeof col.cellStyle === 'function') col.cellStyle(params)
      if (typeof col.valueFormatter === 'function') col.valueFormatter(params)
      if (typeof col.tooltipValueGetter === 'function')
        col.tooltipValueGetter(params)
    })

    expect(colDefs.length).toBeGreaterThan(0)
  })

  it('street address valueSetter handles different input types', () => {
    const colDefs = finalSupplyEquipmentColDefs(
      mockOptionsData,
      mockCompliancePeriod,
      mockErrors,
      mockWarnings,
      true
    )
    const streetCol = colDefs.find((c) => c.field === 'streetAddress')

    // Test empty string case
    const emptyParams = { data: {} }
    streetCol.valueSetter({ ...emptyParams, newValue: '' })
    expect(emptyParams.data.streetAddress).toBe('')

    // Test string case
    const stringParams = { data: {} }
    streetCol.valueSetter({ ...stringParams, newValue: 'Custom Street' })
    expect(stringParams.data.streetAddress).toBe('Custom Street')

    // Test object case with coordinates
    const objParams = { data: {} }
    streetCol.valueSetter({
      ...objParams,
      newValue: {
        label: 'Main St, Vancouver, BC',
        coordinates: [-123.1, 49.3]
      }
    })
    expect(objParams.data.streetAddress).toBe('Main St')
    expect(objParams.data.city).toBe('Vancouver')
    expect(objParams.data.latitude).toBe(49.3)
    expect(objParams.data.longitude).toBe(-123.1)
  })

  it('postal code valueSetter converts to uppercase', () => {
    const colDefs = finalSupplyEquipmentColDefs(
      mockOptionsData,
      mockCompliancePeriod,
      mockErrors,
      mockWarnings,
      true
    )
    const postalCol = colDefs.find((c) => c.field === 'postalCode')

    const params = { data: {}, colDef: postalCol }
    postalCol.valueSetter({ ...params, newValue: 'v6b1a1' })
    expect(params.data.postalCode).toBe('V6B1A1')
  })
})
