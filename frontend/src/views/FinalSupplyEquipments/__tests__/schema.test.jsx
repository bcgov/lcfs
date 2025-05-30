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
})
