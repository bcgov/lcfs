import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  processFuelSupplyRowData,
  calculateColumnVisibility,
  updateGridColumnsVisibility,
  handleFuelTypeChange,
  handleFuelCategoryChange,
  validateFuelSupply,
  processCellEditingComplete,
  createGridOptions
} from '../_utils'

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-123')
}))

// Mock constants
vi.mock('@/constants/common', () => ({
  DEFAULT_CI_FUEL: {
    Category1: 85.5,
    Category2: 90.0
  },
  DEFAULT_CI_FUEL_CODE: 'DEFAULT_CODE',
  NEW_REGULATION_YEAR: 2023
}))

// Mock formatters
vi.mock('@/utils/formatters', () => ({
  cleanEmptyStringValues: vi.fn((data) => ({ ...data, cleaned: true }))
}))

// Mock schedules
vi.mock('@/utils/schedules.js', () => ({
  handleScheduleSave: vi.fn().mockResolvedValue({ saved: true })
}))

// Mock array utils
vi.mock('@/utils/array.js', () => ({
  isArrayEmpty: vi.fn((arr) => !arr || arr.length === 0)
}))

describe('fuelSupplyUtils', () => {
  // Import actual implementations for testing
  let actualUtils

  beforeEach(async () => {
    actualUtils = await vi.importActual('../_utils')
  })

  describe('processFuelSupplyRowData', () => {
    it('returns empty array when loading', () => {
      const params = {
        fuelSupplyData: null,
        fuelSuppliesLoading: true,
        complianceReportId: '123',
        compliancePeriod: '2024',
        isSupplemental: false
      }

      const result = actualUtils.processFuelSupplyRowData(params)
      expect(result).toEqual([])
    })

    it('returns empty array when no data', () => {
      const params = {
        fuelSupplyData: null,
        fuelSuppliesLoading: false,
        complianceReportId: '123',
        compliancePeriod: '2024',
        isSupplemental: false
      }

      const result = actualUtils.processFuelSupplyRowData(params)
      expect(result).toEqual([])
    })

    it('processes fuel supply data correctly', () => {
      const params = {
        fuelSupplyData: {
          fuelSupplies: [
            { fuelSupplyId: '1', fuelType: 'Diesel', complianceReportId: 456 },
            { fuelSupplyId: '2', fuelType: 'Gasoline', complianceReportId: 789 }
          ]
        },
        fuelSuppliesLoading: false,
        complianceReportId: 123,
        compliancePeriod: '2024',
        isSupplemental: false
      }

      const result = actualUtils.processFuelSupplyRowData(params)

      expect(result).toHaveLength(3) // 2 existing + 1 empty row
      expect(result[0]).toEqual({
        fuelSupplyId: '1',
        fuelType: 'Diesel',
        complianceReportId: 123,
        compliancePeriod: '2024',
        isNewSupplementalEntry: false,
        id: 'mock-uuid-123'
      })
      expect(result[2]).toEqual({
        id: 'mock-uuid-123',
        complianceReportId: 123,
        compliancePeriod: '2024'
      })
    })

    it('handles supplemental report correctly', () => {
      const params = {
        fuelSupplyData: {
          fuelSupplies: [
            { fuelSupplyId: '1', fuelType: 'Diesel', complianceReportId: 123 }
          ]
        },
        fuelSuppliesLoading: false,
        complianceReportId: 123,
        compliancePeriod: '2024',
        isSupplemental: true
      }

      const result = actualUtils.processFuelSupplyRowData(params)
      expect(result[0].isNewSupplementalEntry).toBe(true)
    })

    it('handles empty fuel supplies array', () => {
      const params = {
        fuelSupplyData: { fuelSupplies: [] },
        fuelSuppliesLoading: false,
        complianceReportId: 123,
        compliancePeriod: '2024',
        isSupplemental: false
      }

      const result = actualUtils.processFuelSupplyRowData(params)
      expect(result).toHaveLength(1) // Just the empty row
    })
  })

  describe('calculateColumnVisibility', () => {
    const mockOptionsData = {
      fuelTypes: [
        {
          fuelType: 'Diesel',
          renewable: true,
          fuelCodes: [
            {
              fuelCode: 'C-123',
              fuelProductionFacilityCountry: 'Canada'
            }
          ]
        }
      ]
    }

    it('returns false for both columns when no fuel types', () => {
      const result = actualUtils.calculateColumnVisibility([], null, '2024')
      expect(result).toEqual({
        shouldShowIsCanadaProduced: false,
        shouldShowIsQ1Supplied: false
      })
    })

    it('returns false for both columns when rowData is empty', () => {
      const result = actualUtils.calculateColumnVisibility(
        [],
        mockOptionsData,
        '2024'
      )
      expect(result).toEqual({
        shouldShowIsCanadaProduced: false,
        shouldShowIsQ1Supplied: false
      })
    })

    it('shows IsCanadaProduced for Canadian fuel', () => {
      const rowData = [
        {
          fuelType: 'Diesel',
          fuelCategory: 'Diesel',
          fuelCode: 'C-123',
          provisionOfTheAct: 'DEFAULT_CODE'
        }
      ]

      const result = actualUtils.calculateColumnVisibility(
        rowData,
        mockOptionsData,
        '2024'
      )
      expect(result.shouldShowIsCanadaProduced).toBe(true)
    })

    it('shows IsQ1Supplied for renewable diesel in regulation year', () => {
      const rowData = [
        {
          fuelType: 'Diesel',
          fuelCategory: 'Diesel',
          fuelCode: 'NON-C-123',
          provisionOfTheAct: 'OTHER_CODE'
        }
      ]

      const optionsWithNonCanadian = {
        fuelTypes: [
          {
            fuelType: 'Diesel',
            renewable: true,
            fuelCodes: [
              {
                fuelCode: 'NON-C-123',
                fuelProductionFacilityCountry: 'USA'
              }
            ]
          }
        ]
      }

      const result = actualUtils.calculateColumnVisibility(
        rowData,
        optionsWithNonCanadian,
        '2023'
      )
      expect(result.shouldShowIsQ1Supplied).toBe(true)
    })

    it('handles missing fuel type gracefully', () => {
      const rowData = [{ fuelType: null }]
      const result = actualUtils.calculateColumnVisibility(
        rowData,
        mockOptionsData,
        '2024'
      )
      expect(result).toEqual({
        shouldShowIsCanadaProduced: false,
        shouldShowIsQ1Supplied: false
      })
    })

    it('early exits when both conditions are met', () => {
      const rowData = [
        {
          fuelType: 'Diesel',
          fuelCategory: 'Diesel',
          fuelCode: 'C-123',
          provisionOfTheAct: 'DEFAULT_CODE'
        },
        {
          fuelType: 'Diesel',
          fuelCategory: 'Diesel',
          fuelCode: 'NON-C-456',
          provisionOfTheAct: 'OTHER_CODE'
        }
      ]

      const complexOptionsData = {
        fuelTypes: [
          {
            fuelType: 'Diesel',
            renewable: true,
            fuelCodes: [
              { fuelCode: 'C-123', fuelProductionFacilityCountry: 'Canada' },
              { fuelCode: 'NON-C-456', fuelProductionFacilityCountry: 'USA' }
            ]
          }
        ]
      }

      const result = actualUtils.calculateColumnVisibility(
        rowData,
        complexOptionsData,
        '2023'
      )
      expect(result.shouldShowIsCanadaProduced).toBe(true)
      expect(result.shouldShowIsQ1Supplied).toBe(true)
    })
  })

  describe('updateGridColumnsVisibility', () => {
    let mockGridApi
    let mockGridRef

    beforeEach(() => {
      mockGridApi = {
        getColumn: vi.fn(),
        setColumnsVisible: vi.fn()
      }
      mockGridRef = {
        current: { api: mockGridApi }
      }
    })

    it('does nothing when gridRef is null', () => {
      actualUtils.updateGridColumnsVisibility({ current: null }, {})
      expect(mockGridApi.setColumnsVisible).not.toHaveBeenCalled()
    })

    it('does nothing when api is not available', () => {
      actualUtils.updateGridColumnsVisibility({ current: {} }, {})
      expect(mockGridApi.setColumnsVisible).not.toHaveBeenCalled()
    })

    it('updates column visibility when changed', () => {
      mockGridApi.getColumn.mockImplementation((colId) => ({
        isVisible: () => (colId === 'isCanadaProduced' ? false : true)
      }))

      const columnVisibility = {
        shouldShowIsCanadaProduced: true,
        shouldShowIsQ1Supplied: false
      }

      actualUtils.updateGridColumnsVisibility(mockGridRef, columnVisibility)

      expect(mockGridApi.setColumnsVisible).toHaveBeenCalledWith(
        ['isCanadaProduced'],
        true
      )
      expect(mockGridApi.setColumnsVisible).toHaveBeenCalledTimes(2)
    })

    it('does not update when visibility unchanged', () => {
      mockGridApi.getColumn.mockImplementation(() => ({
        isVisible: () => false
      }))

      const columnVisibility = {
        shouldShowIsCanadaProduced: false,
        shouldShowIsQ1Supplied: false
      }

      actualUtils.updateGridColumnsVisibility(mockGridRef, columnVisibility)
      expect(mockGridApi.setColumnsVisible).not.toHaveBeenCalled()
    })
  })

  describe('handleFuelTypeChange', () => {
    const mockUpdateRowDataValues = vi.fn()
    const mockOptionsData = {
      fuelTypes: [
        {
          fuelType: 'Diesel',
          fuelCategories: [{ fuelCategory: 'Category1' }],
          eerRatios: [{ endUseType: { type: 'Transportation' } }],
          provisions: [{ name: 'Provision A' }]
        }
      ]
    }

    const mockParams = {
      node: {
        data: { fuelType: 'Diesel' },
        setDataValue: vi.fn()
      }
    }

    beforeEach(() => {
      mockUpdateRowDataValues.mockClear()
    })

    it('updates row data when fuel type is found with single options', () => {
      actualUtils.handleFuelTypeChange(
        mockParams,
        mockOptionsData,
        mockUpdateRowDataValues
      )

      expect(mockUpdateRowDataValues).toHaveBeenCalledWith(mockParams.node, {
        fuelCategory: 'Category1',
        endUseType: 'Transportation',
        provisionOfTheAct: 'Provision A',
        isCanadaProduced: false,
        isQ1Supplied: false
      })
    })

    it('updates row data with null values when multiple options exist', () => {
      const multiOptionData = {
        fuelTypes: [
          {
            fuelType: 'Diesel',
            fuelCategories: [
              { fuelCategory: 'Category1' },
              { fuelCategory: 'Category2' }
            ],
            eerRatios: [
              { endUseType: { type: 'Transportation' } },
              { endUseType: { type: 'Industrial' } }
            ],
            provisions: [{ name: 'Provision A' }, { name: 'Provision B' }]
          }
        ]
      }

      actualUtils.handleFuelTypeChange(
        mockParams,
        multiOptionData,
        mockUpdateRowDataValues
      )

      expect(mockUpdateRowDataValues).toHaveBeenCalledWith(mockParams.node, {
        fuelCategory: null,
        endUseType: null,
        provisionOfTheAct: null,
        isCanadaProduced: false,
        isQ1Supplied: false
      })
    })

    it('does nothing when fuel type is not found', () => {
      const mockParamsNotFound = {
        node: { data: { fuelType: 'UnknownFuel' } }
      }

      actualUtils.handleFuelTypeChange(
        mockParamsNotFound,
        mockOptionsData,
        mockUpdateRowDataValues
      )
      expect(mockUpdateRowDataValues).not.toHaveBeenCalled()
    })
  })

  describe('handleFuelCategoryChange', () => {
    const mockUpdateRowDataValues = vi.fn()
    const mockOptionsData = {
      fuelTypes: [
        {
          fuelType: 'Diesel',
          eerRatios: [
            {
              endUseType: { type: 'Transportation' },
              fuelCategory: { fuelCategory: 'Category1' }
            }
          ],
          provisions: [{ name: 'Provision A' }]
        }
      ]
    }

    const mockParams = {
      node: { data: { fuelType: 'Diesel' } },
      data: { fuelCategory: 'Category1' }
    }

    beforeEach(() => {
      mockUpdateRowDataValues.mockClear()
    })

    it('updates row data when fuel category matches', () => {
      actualUtils.handleFuelCategoryChange(
        mockParams,
        mockOptionsData,
        mockUpdateRowDataValues
      )

      expect(mockUpdateRowDataValues).toHaveBeenCalledWith(mockParams.node, {
        endUseType: 'Transportation',
        provisionOfTheAct: 'Provision A',
        isCanadaProduced: false,
        isQ1Supplied: false
      })
    })

    it('does nothing when fuel type is not found', () => {
      const mockParamsNotFound = {
        node: { data: { fuelType: 'UnknownFuel' } },
        data: { fuelCategory: 'Category1' }
      }

      actualUtils.handleFuelCategoryChange(
        mockParamsNotFound,
        mockOptionsData,
        mockUpdateRowDataValues
      )
      expect(mockUpdateRowDataValues).not.toHaveBeenCalled()
    })
  })

  describe('validateFuelSupply', () => {
    const mockAlertRef = {
      current: { triggerAlert: vi.fn() }
    }

    beforeEach(() => {
      mockAlertRef.current.triggerAlert.mockClear()
    })

    it('returns true when validation passes', () => {
      const mockParams = {
        node: { data: { quantity: 100 } },
        colDef: { field: 'quantity' }
      }
      const validationFn = (value) => value > 0

      const result = actualUtils.validateFuelSupply(
        mockParams,
        validationFn,
        'Error message',
        mockAlertRef,
        'quantity'
      )
      expect(result).toBe(true)
      expect(mockAlertRef.current.triggerAlert).not.toHaveBeenCalled()
    })

    it('returns false and triggers alert when validation fails', () => {
      const mockParams = {
        node: { data: { quantity: -1 } },
        colDef: { field: 'quantity' }
      }
      const validationFn = (value) => value > 0

      const result = actualUtils.validateFuelSupply(
        mockParams,
        validationFn,
        'Error message',
        mockAlertRef,
        'quantity'
      )
      expect(result).toBe(false)
      expect(mockAlertRef.current.triggerAlert).toHaveBeenCalledWith({
        message: 'Error message',
        severity: 'error'
      })
    })

    it('returns true when field does not match', () => {
      const mockParams = {
        node: { data: { quantity: -1 } },
        colDef: { field: 'otherField' }
      }
      const validationFn = (value) => value > 0

      const result = actualUtils.validateFuelSupply(
        mockParams,
        validationFn,
        'Error message',
        mockAlertRef,
        'quantity'
      )
      expect(result).toBe(true)
      expect(mockAlertRef.current.triggerAlert).not.toHaveBeenCalled()
    })

    it('validates direct params when no field specified', () => {
      const validationFn = (value) => value > 0

      const resultPass = actualUtils.validateFuelSupply(
        100,
        validationFn,
        'Error message',
        mockAlertRef
      )
      expect(resultPass).toBe(true)

      const resultFail = actualUtils.validateFuelSupply(
        -1,
        validationFn,
        'Error message',
        mockAlertRef
      )
      expect(resultFail).toBe(false)
    })
  })

  describe('processCellEditingComplete', () => {
    const mockAlertRef = {
      current: { triggerAlert: vi.fn() }
    }
    const mockSaveRow = vi.fn()
    const mockT = vi.fn((key) => key)
    const mockSetErrors = vi.fn()
    const mockSetWarnings = vi.fn()
    const mockValidateFn = vi.fn(() => true)

    beforeEach(() => {
      vi.clearAllMocks()
      mockSaveRow.mockResolvedValue({ success: true })
    })

    it('returns null when old and new values are the same', async () => {
      // Import the actual implementation for testing
      const actualUtils = await vi.importActual('../_utils')

      const params = {
        oldValue: 'same',
        newValue: 'same',
        node: { data: { quantity: 100 }, updateData: vi.fn() }
      }

      const result = await actualUtils.processCellEditingComplete({
        params,
        validateFn: mockValidateFn,
        alertRef: mockAlertRef,
        saveRow: mockSaveRow,
        t: mockT,
        setErrors: mockSetErrors,
        setWarnings: mockSetWarnings
      })

      expect(result).toBeNull()
      expect(mockValidateFn).not.toHaveBeenCalled()
    })

    it('returns null when validation fails', async () => {
      const actualUtils = await vi.importActual('../_utils')
      mockValidateFn.mockReturnValue(false)

      const params = {
        oldValue: 'old',
        newValue: 'new',
        node: { data: { quantity: -1 }, updateData: vi.fn() }
      }

      const result = await actualUtils.processCellEditingComplete({
        params,
        validateFn: mockValidateFn,
        alertRef: mockAlertRef,
        saveRow: mockSaveRow,
        t: mockT,
        setErrors: mockSetErrors,
        setWarnings: mockSetWarnings
      })

      expect(result).toBeNull()
      expect(params.node.updateData).not.toHaveBeenCalled()
    })
  })

  describe('createGridOptions', () => {
    it('creates grid options with translated template', () => {
      const mockT = vi.fn((key) => `translated_${key}`)

      const result = actualUtils.createGridOptions(mockT)

      expect(result).toEqual({
        overlayNoRowsTemplate: 'translated_fuelSupply:noFuelSuppliesFound',
        autoSizeStrategy: {
          type: 'fitCellContents',
          defaultMinWidth: 50,
          defaultMaxWidth: 600
        }
      })
      expect(mockT).toHaveBeenCalledWith('fuelSupply:noFuelSuppliesFound')
    })
  })
})
