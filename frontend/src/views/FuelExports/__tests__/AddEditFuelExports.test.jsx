import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { AddEditFuelExports } from '../AddEditFuelExports'
import * as useFuelExport from '@/hooks/useFuelExport'
import * as useCurrentUser from '@/hooks/useCurrentUser'
import * as useComplianceReports from '@/hooks/useComplianceReports'
import { wrapper } from '@/tests/utils/wrapper'
import { fuelExportColDefs } from '../_schema'

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mocked-uuid-1234')
}))

// Mock utility functions
vi.mock('@/utils/array.js', () => ({
  isArrayEmpty: vi.fn((arr) => !arr || arr.length === 0)
}))

vi.mock('@/utils/schedules.js', () => ({
  handleScheduleSave: vi.fn(async ({ updatedData }) => updatedData),
  handleScheduleDelete: vi.fn()
}))

vi.mock('@/utils/grid/changelogCellStyle', () => ({
  changelogRowStyle: vi.fn()
}))

// Mock routes
vi.mock('@/routes/routes', () => ({
  ROUTES: {
    REPORTS: {
      VIEW: '/reports/view'
    }
  },
  buildPath: vi.fn(() => '/reports/view/123/456')
}))

// Mock i18n
vi.mock('react-i18n', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock BC components
vi.mock('@/components/BCBox', () => ({
  default: ({ children }) => <div>{children}</div>
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children }) => <div>{children}</div>
}))

vi.mock('@mui/material/Grid2', () => ({
  default: ({ children }) => <div>{children}</div>
}))

// Mock BCGridEditor component
vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: vi.fn(
    ({ alertRef, onGridReady, rowData, onAction, saveButtonProps }) => {
      // Simulate onGridReady being called
      React.useEffect(() => {
        if (onGridReady) {
          setTimeout(() => {
            onGridReady({
              api: {
                sizeColumnsToFit: vi.fn(),
                getLastDisplayedRowIndex: vi.fn(() => 0),
                startEditingCell: vi.fn()
              }
            })
          }, 0)
        }
      }, [onGridReady])

      return (
        <div data-testid="grid-editor">
          <div>Mocked Grid Editor</div>
          <div data-testid="row-count">Row Count: {rowData?.length || 0}</div>
          <button data-testid="save-button" onClick={saveButtonProps?.onSave}>
            {saveButtonProps?.text || 'Save'}
          </button>
          <button
            data-testid="delete-button"
            onClick={() =>
              onAction && onAction('delete', { node: { data: rowData[0] } })
            }
          >
            Delete
          </button>
        </div>
      )
    }
  )
}))

const mockNavigate = vi.fn()
const mockSearchParams = new URLSearchParams()
mockSearchParams.get = vi.fn((param) => null)

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({
    complianceReportId: '123',
    compliancePeriod: '2024'
  }),
  useLocation: () => ({ state: {} }),
  useSearchParams: () => [mockSearchParams, vi.fn()],
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: ({ children }) => <div>{children}</div>
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

describe('AddEditFuelExports Component', () => {
  const mockFuelExportOptions = {
    fuelTypes: [
      {
        fuelTypeId: 1,
        fuelType: 'Gasoline',
        provisions: [
          { provisionOfTheActId: 1, name: 'Default CI' },
          { provisionOfTheActId: 2, name: 'Fuel code - section 19 (b) (i)' }
        ],
        fuelCategories: [{ fuelCategoryId: 1, fuelCategory: 'Gasoline' }],
        fuelCodes: [
          {
            fuelCodeId: 1,
            fuelCode: 'GASOLINE-001',
            fuelCodeCarbonIntensity: 80,
            fuelCodeEffectiveDate: '2024-01-01',
            fuelCodeExpirationDate: '2025-01-01'
          }
        ],
        eerRatios: [
          {
            fuelCategory: { fuelCategoryId: 1, fuelCategory: 'Gasoline' },
            endUseType: { endUseTypeId: 1, type: 'Transportation' },
            energyEffectivenessRatio: 1.0
          }
        ],
        defaultCarbonIntensity: 90,
        targetCarbonIntensities: [
          {
            fuelCategory: { fuelCategoryId: 1, fuelCategory: 'Gasoline' },
            targetCarbonIntensity: 85
          }
        ],
        energyDensity: { energyDensity: 35, unit: 'MJ/L' },
        unit: 'L'
      },
      {
        fuelTypeId: 2,
        fuelType: 'Other',
        provisions: [{ provisionOfTheActId: 1, name: 'Default CI' }],
        fuelCategories: [
          {
            fuelCategoryId: 2,
            fuelCategory: 'Other Fuel',
            defaultAndPrescribedCi: 95
          }
        ],
        eerRatios: [
          {
            fuelCategory: { fuelCategoryId: 2, fuelCategory: 'Other Fuel' },
            endUseType: { endUseTypeId: 1, type: 'Any' },
            energyEffectivenessRatio: 1.0
          }
        ],
        defaultCarbonIntensity: 100,
        targetCarbonIntensities: [
          {
            fuelCategory: { fuelCategoryId: 2, fuelCategory: 'Other Fuel' },
            targetCarbonIntensity: 90
          }
        ],
        energyDensity: { energyDensity: 30, unit: 'MJ/L' },
        unit: 'L'
      }
    ]
  }

  const mockFuelExportsList = {
    fuelExports: [
      {
        fuelExportId: 1,
        fuelType: { fuelTypeId: 1, fuelType: 'Gasoline' },
        fuelCategory: { fuelCategoryId: 1, fuelCategory: 'Gasoline' },
        provisionOfTheAct: { provisionOfTheActId: 1, name: 'Default CI' },
        quantity: 1000,
        units: 'L',
        complianceUnits: 10
      }
    ]
  }

  const mockComplianceReport = {
    report: {
      id: '123',
      version: 0
    }
  }

  const mockSupplementalReport = {
    report: {
      id: '123',
      version: 1
    }
  }

  const mockCurrentUser = {
    organization: {
      organizationId: 'org123'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    vi.spyOn(useFuelExport, 'useFuelExportOptions').mockReturnValue({
      data: mockFuelExportOptions,
      isLoading: false,
      isFetched: true
    })

    vi.spyOn(useFuelExport, 'useGetFuelExportsList').mockReturnValue({
      data: mockFuelExportsList,
      isLoading: false
    })

    vi.spyOn(useFuelExport, 'useSaveFuelExport').mockReturnValue({
      mutateAsync: vi.fn(async (data) => data)
    })

    vi.spyOn(useCurrentUser, 'useCurrentUser').mockReturnValue({
      data: mockCurrentUser,
      isLoading: false
    })

    vi.spyOn(
      useComplianceReports,
      'useComplianceReportWithCache'
    ).mockReturnValue({
      data: mockComplianceReport,
      isLoading: false
    })

    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    }))

    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 120,
      height: 120,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0
    }))

    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Component Initialization', () => {
    it('waits for all data to load before rendering content', () => {
      const renderLoadingState = () => {
        vi.spyOn(useFuelExport, 'useFuelExportOptions').mockReturnValueOnce({
          data: undefined,
          isLoading: true,
          isFetched: false
        })

        vi.spyOn(useFuelExport, 'useGetFuelExportsList').mockReturnValueOnce({
          data: undefined,
          isLoading: true
        })

        vi.spyOn(useCurrentUser, 'useCurrentUser').mockReturnValueOnce({
          data: undefined,
          isLoading: true
        })

        vi.spyOn(
          useComplianceReports,
          'useComplianceReportWithCache'
        ).mockReturnValueOnce({
          data: undefined,
          isLoading: true
        })

        const { queryByTestId } = render(<AddEditFuelExports />, { wrapper })
        return queryByTestId('grid-editor')
      }

      const gridEditor = renderLoadingState()
      expect(gridEditor).not.toBeInTheDocument()
    })
  })

  describe('Supplemental Report Handling', () => {
    beforeEach(() => {
      vi.spyOn(
        useComplianceReports,
        'useComplianceReportWithCache'
      ).mockReturnValue({
        data: mockSupplementalReport,
        isLoading: false
      })
    })

    it('requests changelog data for supplemental reports', async () => {
      render(<AddEditFuelExports />, { wrapper })

      expect(useFuelExport.useGetFuelExportsList).toHaveBeenCalledWith({
        complianceReportId: '123',
        changelog: true
      })
    })
  })
})

describe('ciOfFuel valueGetter functionality', () => {
  const mockOptionsData = {
    fuelTypes: [
      {
        fuelTypeId: 1,
        fuelType: 'Gasoline',
        defaultCarbonIntensity: 90,
        fuelCategories: [{ fuelCategoryId: 1, fuelCategory: 'Gasoline' }],
        fuelCodes: [
          {
            fuelCodeId: 1,
            fuelCode: 'GASOLINE-001',
            fuelCodeCarbonIntensity: 80,
            fuelCodeEffectiveDate: '2024-01-01',
            fuelCodeExpirationDate: '2025-01-01'
          },
          {
            fuelCodeId: 2,
            fuelCode: 'GASOLINE-002',
            fuelCodeCarbonIntensity: 75,
            fuelCodeEffectiveDate: '2024-02-01',
            fuelCodeExpirationDate: null
          }
        ]
      },
      {
        fuelTypeId: 2,
        fuelType: 'Other',
        defaultCarbonIntensity: 100,
        fuelCategories: [
          {
            fuelCategoryId: 2,
            fuelCategory: 'Other Fuel',
            defaultAndPrescribedCi: 95
          }
        ],
        fuelCodes: []
      }
    ]
  }

  const columns = fuelExportColDefs(mockOptionsData, {}, {}, true, false)
  const ciOfFuelColumn = columns.find((col) => col.field === 'ciOfFuel')
  const valueGetter = ciOfFuelColumn.valueGetter

  it('should return default CI for a fuel type when provision is not "Unknown" or fuel code-related', () => {
    const params = {
      data: {
        fuelType: 'Gasoline',
        fuelCategory: 'Gasoline',
        provisionOfTheAct: 'Default CI'
      }
    }

    const result = valueGetter(params)
    expect(result).toBe(90) // Default CI for Gasoline
  })

  it('should return fuel code CI when provision is fuel code-related and a fuel code is selected', () => {
    const params = {
      data: {
        fuelType: 'Gasoline',
        fuelCategory: 'Gasoline',
        provisionOfTheAct: 'Fuel code - section 19 (b) (i)',
        fuelCode: 'GASOLINE-001'
      }
    }

    const result = valueGetter(params)
    expect(result).toBe(80) // CI from the selected fuel code
  })

  it('should return category default CI for "Other" fuel type', () => {
    const params = {
      data: {
        fuelType: 'Other',
        fuelCategory: 'Other Fuel',
        provisionOfTheAct: 'Default CI'
      }
    }

    const result = valueGetter(params)
    expect(result).toBe(95) // Default CI from the category for "Other" fuel type
  })

  it('should find the minimum CI from valid fuel codes when provision is "Unknown"', () => {
    // Mock current date to be in 2024 for testing
    const originalDate = Date
    global.Date = class extends Date {
      constructor(date) {
        if (date) {
          return new originalDate(date)
        }
        return new originalDate('2024-07-01')
      }
    }

    const params = {
      data: {
        fuelType: 'Gasoline',
        fuelCategory: 'Gasoline',
        provisionOfTheAct: 'Unknown',
        exportDate: '2024-05-01' // Date when both fuel codes are valid
      }
    }

    const result = valueGetter(params)
    expect(result).toBe(75) // Minimum CI from the valid fuel codes

    // Restore original Date
    global.Date = originalDate
  })

  it('should return default CI when provision is "Unknown" but no valid fuel codes exist', () => {
    // Mock current date
    const originalDate = Date
    global.Date = class extends Date {
      constructor(date) {
        if (date) {
          return new originalDate(date)
        }
        return new originalDate('2026-01-01')
      }
    }

    const params = {
      data: {
        fuelType: 'Gasoline',
        fuelCategory: 'Gasoline',
        provisionOfTheAct: 'Unknown',
        exportDate: '2026-01-01' // After all fuel codes expire
      }
    }

    const result = valueGetter(params)
    expect(result).toBe(90) // Default CI for Gasoline

    // Restore original Date
    global.Date = originalDate
  })

  it('should return default CI when provision is "Unknown" but export date is missing', () => {
    const params = {
      data: {
        fuelType: 'Gasoline',
        fuelCategory: 'Gasoline',
        provisionOfTheAct: 'Unknown',
        exportDate: null // Missing export date
      }
    }

    const result = valueGetter(params)
    expect(result).toBe(90) // Default CI for Gasoline
  })

  it('should handle invalid export date formats correctly', () => {
    const params = {
      data: {
        fuelType: 'Gasoline',
        fuelCategory: 'Gasoline',
        provisionOfTheAct: 'Unknown',
        exportDate: 'not-a-date' // Invalid date format
      }
    }

    const result = valueGetter(params)
    expect(result).toBe(90) // Default CI for Gasoline
  })

  it('should handle fuel code with exact match to export date', () => {
    // Mock current date
    const originalDate = Date
    global.Date = class extends Date {
      constructor(date) {
        if (date) {
          return new originalDate(date)
        }
        return new originalDate('2024-01-01')
      }
    }

    const params = {
      data: {
        fuelType: 'Gasoline',
        fuelCategory: 'Gasoline',
        provisionOfTheAct: 'Unknown',
        exportDate: '2024-01-01' // Exact match to first fuel code effective date
      }
    }

    const result = valueGetter(params)
    expect(result).toBe(80) // Only the first code should apply (80)

    global.Date = originalDate
  })
})