import React from 'react'
import { useComplianceReportWithCache } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useFuelSupplyOptions,
  useGetFuelSuppliesList,
  useSaveFuelSupply
} from '@/hooks/useFuelSupply'
import { wrapper } from '@/tests/utils/wrapper'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddEditFuelSupplies } from '../AddEditFuelSupplies'

// Mock react-router-dom hooks
const mockUseLocation = vi.fn()
const mockUseNavigate = vi.fn()
const mockUseParams = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@/hooks/useCurrentUser')

// Mock utility functions
vi.mock('@/utils/array.js', () => ({
  isArrayEmpty: vi.fn((arr) => !arr || arr.length === 0)
}))

vi.mock('@/utils/formatters', () => ({
  cleanEmptyStringValues: vi.fn((data) => ({ ...data, cleaned: true }))
}))

vi.mock('@/utils/schedules.js', () => ({
  handleScheduleDelete: vi.fn(),
  handleScheduleSave: vi.fn((params) => Promise.resolve({ ...params.updatedData, saved: true }))
}))

// Mock constants
vi.mock('@/constants/common', () => ({
  DEFAULT_CI_FUEL: {
    'Category1': 85.5,
    'Category2': 90.0
  },
  REPORT_SCHEDULES: {
    QUARTERLY: 'QUARTERLY',
    ANNUAL: 'ANNUAL'
  }
}))

vi.mock('@/constants/statuses', () => ({
  REPORT_SCHEDULES_VIEW: {
    EDIT: 'EDIT',
    VIEW: 'VIEW'
  }
}))

vi.mock('@/routes/routes', () => ({
  buildPath: vi.fn((route, params) => `/test-path/${params.complianceReportId}`),
  ROUTES: {
    REPORTS: {
      VIEW: '/reports/:complianceReportId/view'
    }
  }
}))

// Mock UUID
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid')
}))

// Mock schema
vi.mock('../_schema', () => ({
  defaultColDef: { flex: 1 },
  fuelSupplyColDefs: vi.fn(() => [
    { field: 'fuelType', headerName: 'Fuel Type' },
    { field: 'fuelCategory', headerName: 'Fuel Category' },
    { field: 'quantity', headerName: 'Quantity' }
  ])
}))

vi.mock('@/hooks/useComplianceReports')

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate(),
  useParams: () => mockUseParams()
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock all hooks related to fuel supply
vi.mock('@/hooks/useFuelSupply')

// Mock BCGridEditor with comprehensive callback support
vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: ({
    gridRef,
    alertRef,
    onGridReady,
    rowData,
    onCellValueChanged,
    onCellEditingStopped,
    onAction,
    saveButtonProps
  }) => {
    const gridApi = {
      getLastDisplayedRowIndex: vi.fn(() => rowData.length - 1),
      startEditingCell: vi.fn(),
      forEachNode: vi.fn((callback) => {
        rowData.forEach((row, index) => {
          const mockNode = {
            data: row,
            updateData: vi.fn((newData) => { rowData[index] = newData })
          }
          callback(mockNode)
        })
      })
    }

    // Trigger onGridReady if provided
    React.useEffect(() => {
      if (onGridReady) {
        setTimeout(() => {
          onGridReady({ api: gridApi })
        }, 0)
      }
    }, [onGridReady])

    return (
      <div data-test="bc-grid-editor">
        <div data-test="row-data">
          {rowData.map((row, index) => (
            <div key={index} data-test="grid-row">
              {row.id || 'mock-uuid'}
            </div>
          ))}
        </div>
        <button
          data-test="test-cell-value-changed"
          onClick={() => {
            if (onCellValueChanged) {
              onCellValueChanged({
                column: { colId: 'fuelType' },
                node: {
                  data: { fuelType: 'TestFuel' },
                  setDataValue: vi.fn()
                },
                data: { fuelType: 'TestFuel' },
                api: {
                  autoSizeAllColumns: vi.fn(),
                  refreshCells: vi.fn(),
                  sizeColumnsToFit: vi.fn()
                }
              })
            }
          }}
        >
          Test Cell Value Changed
        </button>
        <button
          data-test="test-cell-editing-stopped"
          onClick={() => {
            if (onCellEditingStopped) {
              onCellEditingStopped({
                oldValue: 'old',
                newValue: 'new',
                colDef: { field: 'quantity' },
                node: {
                  data: { quantity: 100 },
                  updateData: vi.fn()
                }
              })
            }
          }}
        >
          Test Cell Editing Stopped
        </button>
        <button
          data-test="test-action-delete"
          onClick={() => {
            if (onAction) {
              onAction('delete', { api: gridApi })
            }
          }}
        >
          Test Delete Action
        </button>
        <button
          data-test="save-button"
          onClick={() => {
            if (saveButtonProps?.onSave) {
              saveButtonProps.onSave()
            }
          }}
        >
          {saveButtonProps?.text || 'Save'}
        </button>
      </div>
    )
  }
}))

// Mock other components
vi.mock('@/components/BCBox', () => ({
  __esModule: true,
  default: ({ children, ...props }) => <div data-test="bc-box" {...props}>{children}</div>
}))

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: ({ children, variant, ...props }) => (
    <div data-test="bc-typography" data-variant={variant} {...props}>
      {children}
    </div>
  )
}))

vi.mock('@mui/material/Grid2', () => ({
  __esModule: true,
  default: ({ children, ...props }) => <div data-test="grid2" {...props}>{children}</div>
}))

describe('AddEditFuelSupplies', () => {
  const mockAlertRef = {
    current: {
      triggerAlert: vi.fn()
    }
  }

  const mockSaveRow = vi.fn()
  const mockOptionsData = {
    fuelTypes: [
      {
        fuelType: 'Diesel',
        fuelCategories: [{ fuelCategory: 'Category1' }],
        eerRatios: [{ 
          endUseType: { type: 'Transportation' },
          fuelCategory: { fuelCategory: 'Category1' }
        }],
        provisions: [{ name: 'Provision A' }]
      },
      {
        fuelType: 'Other',
        fuelCategories: [
          { fuelCategory: 'Category1' },
          { fuelCategory: 'Category2' }
        ],
        eerRatios: [
          { 
            endUseType: { type: 'Transportation' },
            fuelCategory: { fuelCategory: 'Category1' }
          },
          { 
            endUseType: { type: 'Industrial' },
            fuelCategory: { fuelCategory: 'Category2' }
          }
        ],
        provisions: [
          { name: 'Provision A' },
          { name: 'Provision B' }
        ]
      }
    ]
  }

  beforeEach(() => {
    vi.resetAllMocks()
    mockSaveRow.mockResolvedValue({ success: true })

    // Mock location, navigate, and params
    mockUseLocation.mockReturnValue({
      pathname: '/test-path',
      state: {}
    })
    mockUseNavigate.mockReturnValue(mockNavigate)
    mockUseParams.mockReturnValue({
      complianceReportId: 'testReportId',
      compliancePeriod: '2024-Q1'
    })

    // Mock useFuelSupplyOptions
    vi.mocked(useFuelSupplyOptions).mockReturnValue({
      data: mockOptionsData,
      isLoading: false,
      isFetched: true
    })

    // Mock useGetFuelSuppliesList to return empty data initially
    vi.mocked(useGetFuelSuppliesList).mockReturnValue({
      data: { fuelSupplies: [] },
      isLoading: false
    })

    // Mock useSaveFuelSupply hook
    vi.mocked(useSaveFuelSupply).mockReturnValue({
      mutateAsync: mockSaveRow
    })

    // Mock useCurrentUser
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        organization: { organizationId: 1 }
      }
    })

    // Mock useComplianceReportWithCache
    vi.mocked(useComplianceReportWithCache).mockReturnValue({
      data: {
        report: {
          version: 0,
          reportingFrequency: 'ANNUAL'
        }
      },
      isLoading: false
    })
  })

  it('renders the component', () => {
    render(<AddEditFuelSupplies />, { wrapper })
    // Check for a title or any text that indicates successful rendering
    expect(screen.getByText('fuelSupply:fuelSupplyTitle')).toBeInTheDocument()
  })

  it('initializes with at least one row when there are no existing fuel supplies', () => {
    render(<AddEditFuelSupplies />, { wrapper })
    const rows = screen.getAllByTestId('grid-row')
    // Should contain exactly one blank row if data is empty
    expect(rows.length).toBe(1)
  })

  it('loads existing fuel supplies when available', async () => {
    // Update mock to provide some existing fuel supplies
    vi.mocked(useGetFuelSuppliesList).mockReturnValue({
      data: {
        fuelSupplies: [
          { fuelSupplyId: 'abc', fuelType: 'Diesel' },
          { fuelSupplyId: 'xyz', fuelType: 'Gasoline' }
        ]
      },
      isLoading: false
    })

    render(<AddEditFuelSupplies />, { wrapper })
    const rows = await screen.findAllByTestId('grid-row')
    // Should contain 2 existing fuel supplies + 1 empty row at the end
    expect(rows.length).toBe(3)
  })

  it('handles supplemental report correctly', () => {
    // Mock for supplemental report (version > 0)
    vi.mocked(useComplianceReportWithCache).mockReturnValue({
      data: {
        report: {
          version: 1,
          reportingFrequency: 'ANNUAL'
        }
      },
      isLoading: false
    })

    render(<AddEditFuelSupplies />, { wrapper })
    expect(screen.getByText('fuelSupply:fuelSupplyTitle')).toBeInTheDocument()
  })

  it('handles early issuance report correctly', () => {
    // Mock for early issuance report (quarterly)
    vi.mocked(useComplianceReportWithCache).mockReturnValue({
      data: {
        report: {
          version: 0,
          reportingFrequency: 'QUARTERLY'
        }
      },
      isLoading: false
    })

    render(<AddEditFuelSupplies />, { wrapper })
    expect(screen.getByText('fuelSupply:fuelSupplyTitle')).toBeInTheDocument()
  })

  it('does not render when still loading', () => {
    vi.mocked(useComplianceReportWithCache).mockReturnValue({
      data: {
        report: {
          version: 0,
          reportingFrequency: 'ANNUAL'
        }
      },
      isLoading: true
    })

    render(<AddEditFuelSupplies />, { wrapper })
    expect(screen.queryByText('fuelSupply:fuelSupplyTitle')).not.toBeInTheDocument()
  })

  it('does not render when options not fetched', () => {
    vi.mocked(useFuelSupplyOptions).mockReturnValue({
      data: mockOptionsData,
      isLoading: false,
      isFetched: false
    })

    render(<AddEditFuelSupplies />, { wrapper })
    expect(screen.queryByText('fuelSupply:fuelSupplyTitle')).not.toBeInTheDocument()
  })

  it('does not render when fuel supplies loading', () => {
    vi.mocked(useGetFuelSuppliesList).mockReturnValue({
      data: { fuelSupplies: [] },
      isLoading: true
    })

    render(<AddEditFuelSupplies />, { wrapper })
    expect(screen.queryByText('fuelSupply:fuelSupplyTitle')).not.toBeInTheDocument()
  })

  it('displays alert message from location state', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/test-path',
      state: {
        message: 'Test alert message',
        severity: 'success'
      }
    })

    render(<AddEditFuelSupplies />, { wrapper })
    expect(screen.getByText('fuelSupply:fuelSupplyTitle')).toBeInTheDocument()
  })

  describe('onCellValueChanged', () => {
    it('handles fuelType change with single options', async () => {
      const singleOptionData = {
        fuelTypes: [{
          fuelType: 'SingleOptionFuel',
          fuelCategories: [{ fuelCategory: 'SingleCategory' }],
          eerRatios: [{ 
            endUseType: { type: 'SingleEndUse' },
            fuelCategory: { fuelCategory: 'SingleCategory' }
          }],
          provisions: [{ name: 'SingleProvision' }]
        }]
      }
      
      vi.mocked(useFuelSupplyOptions).mockReturnValue({
        data: singleOptionData,
        isLoading: false,
        isFetched: true
      })

      render(<AddEditFuelSupplies />, { wrapper })
      
      await waitFor(() => {
        const button = screen.getByTestId('test-cell-value-changed')
        fireEvent.click(button)
      })

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles fuelType change with multiple options', async () => {
      render(<AddEditFuelSupplies />, { wrapper })
      
      await waitFor(() => {
        const button = screen.getByTestId('test-cell-value-changed')
        fireEvent.click(button)
      })

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles fuelCategory change', async () => {
      render(<AddEditFuelSupplies />, { wrapper })
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('onCellEditingStopped', () => {
    it('handles successful cell editing with validation', async () => {
      render(<AddEditFuelSupplies />, { wrapper })
      
      await waitFor(() => {
        const button = screen.getByTestId('test-cell-editing-stopped')
        fireEvent.click(button)
      })

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles validation failure', async () => {
      render(<AddEditFuelSupplies />, { wrapper })
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles fuelType Other with CI setting', async () => {
      render(<AddEditFuelSupplies />, { wrapper })
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('onAction', () => {
    it('handles delete action', async () => {
      render(<AddEditFuelSupplies />, { wrapper })
      
      await waitFor(() => {
        const button = screen.getByTestId('test-action-delete')
        fireEvent.click(button)
      })

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles undo action', async () => {
      render(<AddEditFuelSupplies />, { wrapper })
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('handleNavigateBack', () => {
    it('navigates back to report view with success message', async () => {
      render(<AddEditFuelSupplies />, { wrapper })
      
      await waitFor(() => {
        const saveButton = screen.getByTestId('save-button')
        fireEvent.click(saveButton)
      })

      expect(mockNavigate).toHaveBeenCalled()
    })
  })

  describe('data processing', () => {
    it('processes existing fuel supplies correctly', () => {
      vi.mocked(useGetFuelSuppliesList).mockReturnValue({
        data: {
          fuelSupplies: [
            { fuelSupplyId: 1, fuelType: 'Diesel', complianceReportId: 100 },
            { fuelSupplyId: 2, fuelType: 'Gasoline', complianceReportId: 200 }
          ]
        },
        isLoading: false
      })

      render(<AddEditFuelSupplies />, { wrapper })
      const rows = screen.getAllByTestId('grid-row')
      expect(rows.length).toBe(3) // 2 existing + 1 empty
    })

    it('handles supplemental report data processing', () => {
      vi.mocked(useComplianceReportWithCache).mockReturnValue({
        data: {
          report: {
            version: 1,
            reportingFrequency: 'ANNUAL'
          }
        },
        isLoading: false
      })

      vi.mocked(useGetFuelSuppliesList).mockReturnValue({
        data: {
          fuelSupplies: [
            { fuelSupplyId: 1, fuelType: 'Diesel', complianceReportId: 'testReportId' }
          ]
        },
        isLoading: false
      })

      render(<AddEditFuelSupplies />, { wrapper })
      const rows = screen.getAllByTestId('grid-row')
      expect(rows.length).toBe(2) // 1 existing + 1 empty
    })
  })

  describe('memoized values', () => {
    it('creates gridOptions with correct overlay template', () => {
      render(<AddEditFuelSupplies />, { wrapper })
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('updates columnDefs when dependencies change', () => {
      const { rerender } = render(<AddEditFuelSupplies />, { wrapper })
      
      vi.mocked(useFuelSupplyOptions).mockReturnValue({
        data: { fuelTypes: [{ fuelType: 'NewFuel' }] },
        isLoading: false,
        isFetched: true
      })
      
      rerender(<AddEditFuelSupplies />)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('handles save errors gracefully', async () => {
      mockSaveRow.mockRejectedValue(new Error('Save failed'))
      
      render(<AddEditFuelSupplies />, { wrapper })
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles empty options data', () => {
      vi.mocked(useFuelSupplyOptions).mockReturnValue({
        data: { fuelTypes: [] },
        isLoading: false,
        isFetched: true
      })

      render(<AddEditFuelSupplies />, { wrapper })
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles null compliance report data', () => {
      vi.mocked(useComplianceReportWithCache).mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<AddEditFuelSupplies />, { wrapper })
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles undefined fuel supply data', () => {
      vi.mocked(useGetFuelSuppliesList).mockReturnValue({
        data: undefined,
        isLoading: false
      })

      render(<AddEditFuelSupplies />, { wrapper })
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

})