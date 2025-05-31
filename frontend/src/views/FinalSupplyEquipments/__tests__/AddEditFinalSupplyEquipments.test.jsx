import { describe, it, expect } from 'vitest'
import { finalSupplyEquipmentColDefs } from '../_schema'
import { DateEditor } from '@/components/BCDataGrid/components'
import dayjs from 'dayjs'

// Test the schema directly instead of trying to render the component
describe('FinalSupplyEquipment Schema', () => {
  it('should have separate supplyFromDate and supplyToDate columns using the DateEditor component', () => {
    // Create test data
    const mockOptionsData = {
      organizationNames: ['Test Org 1', 'Test Org 2'],
      levelsOfEquipment: [{ name: 'Level 1' }, { name: 'Level 2' }],
      intendedUseTypes: [{ type: 'Type 1' }],
      intendedUserTypes: [{ typeName: 'User 1' }],
      ports: ['Port 1']
    }
    const mockCompliancePeriod = '2023'
    const mockErrors = {}
    const mockWarnings = {}
    const mockGridReady = true

    // Generate column definitions
    const colDefs = finalSupplyEquipmentColDefs(
      mockOptionsData,
      mockCompliancePeriod,
      mockErrors,
      mockWarnings,
      mockGridReady,
      null // status parameter for testing
    )

    // Find the columns
    const supplyFromColumn = colDefs.find((col) => col.field === 'supplyFrom')
    const supplyFromDateColumn = colDefs.find(
      (col) => col.field === 'supplyFromDate'
    )
    const supplyToDateColumn = colDefs.find(
      (col) => col.field === 'supplyToDate'
    )

    // Verify old column doesn't exist
    expect(supplyFromColumn).toBe(undefined)

    // Verify new columns exist and use DateEditor component directly
    expect(supplyFromDateColumn).toBeDefined()
    expect(supplyToDateColumn).toBeDefined()
    expect(supplyFromDateColumn.cellEditor).toBe(DateEditor)
    expect(supplyToDateColumn.cellEditor).toBe(DateEditor)

    // Check that the autoOpenLastRow parameter is set correctly
    expect(supplyFromDateColumn.cellEditorParams.autoOpenLastRow).toBe(
      !mockGridReady
    )
    expect(supplyToDateColumn.cellEditorParams.autoOpenLastRow).toBe(
      !mockGridReady
    )

    // Verify the columns have cellRenderer for proper display
    expect(supplyFromDateColumn.cellRenderer).toBeDefined()
    expect(supplyToDateColumn.cellRenderer).toBeDefined()

    // Check the date formats and value handling
    const mockParams = { data: { supplyFromDate: '2023-02-01' } }
    expect(supplyFromDateColumn.valueGetter(mockParams)).toBe('2023-02-01')

    const fromParams = { ...mockParams, newValue: '2023-03-15' }
    supplyFromDateColumn.valueSetter(fromParams)
    expect(fromParams.data.supplyFromDate).toBe('2023-03-15')

    // Test date ranges
    const toMockParams = { data: { supplyToDate: '2023-09-30' } }
    expect(supplyToDateColumn.valueGetter(toMockParams)).toBe('2023-09-30')

    const toParams = { ...toMockParams, newValue: '2023-12-15' }
    supplyToDateColumn.valueSetter(toParams)
    expect(toParams.data.supplyToDate).toBe('2023-12-15')

    // Test default values for empty data
    const emptyParams = { data: {} }
    expect(supplyFromDateColumn.valueGetter(emptyParams)).toBe('2023-01-01')
    expect(supplyToDateColumn.valueGetter(emptyParams)).toBe('2023-12-31')

    // Check that date constraints are set correctly
    const expectedMinDate = dayjs('2023-01-01', 'YYYY-MM-DD').toDate()
    const expectedMaxDate = dayjs('2023-12-31', 'YYYY-MM-DD').toDate()

    expect(supplyFromDateColumn.cellEditorParams.minDate.getFullYear()).toBe(
      expectedMinDate.getFullYear()
    )
    expect(supplyFromDateColumn.cellEditorParams.minDate.getMonth()).toBe(
      expectedMinDate.getMonth()
    )
    expect(supplyFromDateColumn.cellEditorParams.minDate.getDate()).toBe(
      expectedMinDate.getDate()
    )

    expect(supplyToDateColumn.cellEditorParams.maxDate.getFullYear()).toBe(
      expectedMaxDate.getFullYear()
    )
    expect(supplyToDateColumn.cellEditorParams.maxDate.getMonth()).toBe(
      expectedMaxDate.getMonth()
    )
    expect(supplyToDateColumn.cellEditorParams.maxDate.getDate()).toBe(
      expectedMaxDate.getDate()
    )
  })
})
