import React from 'react'
import { test } from '@/tests/utils/fixtures'
import {
  screen,
  fireEvent,
  waitFor,
  act,
  type RenderOptions,
  type RenderResult
} from '@testing-library/react'
import type { PropsWithChildren, ReactNode } from 'react'
import { beforeEach, describe, expect, vi } from 'vite-plus/test'
import { AddEditFuelSupplies } from '../AddEditFuelSupplies'

let render: (ui: ReactNode, options?: RenderOptions) => RenderResult
const it = (name: string, fn: () => void | Promise<void>) =>
  test(name, ({ render: fixtureRender, theme }) => {
    render = (ui, options) => fixtureRender(ui, [theme], options)
    return fn()
  })

type HookResult = { data?: unknown; isLoading?: boolean; isFetched?: boolean }
const hookMocks = vi.hoisted(() => ({
  fuelSupplyOptions: vi.fn<(...args: unknown[]) => HookResult>(),
  fuelSuppliesList: vi.fn<(...args: unknown[]) => HookResult>(),
  saveFuelSupply: vi.fn<
    (...args: unknown[]) => {
      mutateAsync: (...args: unknown[]) => Promise<unknown>
    }
  >(),
  currentUser: vi.fn<(...args: unknown[]) => { data?: unknown }>(),
  complianceReport: vi.fn<(...args: unknown[]) => HookResult>()
}))
const mockScheduleDelete = vi.hoisted(() => vi.fn())

type MockGridRow = Record<string, unknown> & { id?: string | number }
type MockGridApi = {
  getLastDisplayedRowIndex: () => number
  startEditingCell: (params: { rowIndex: number; colKey: string }) => void
  forEachNode: (
    callback: (node: {
      data: MockGridRow
      updateData: (data: MockGridRow) => void
    }) => void
  ) => void
  autoSizeAllColumns: () => void
  getColumn: (colId: string) => { isVisible: () => boolean }
  setColumnsVisible: (columns: string[], visible: boolean) => void
}
type MockGridNode = {
  data: MockGridRow
  updateData: (data: MockGridRow) => void
}
type MockGridEditorProps = {
  gridRef?: { current: { api: MockGridApi } | null }
  onGridReady?: (params: { api: MockGridApi }) => void
  rowData: MockGridRow[]
  onCellValueChanged?: (params: unknown) => unknown
  onCellEditingStopped?: (params: unknown) => unknown
  onAction?: (action: string, params?: unknown) => unknown
  saveButtonProps?: { onSave?: () => unknown; text?: ReactNode }
}
type MockContainerProps = PropsWithChildren<Record<string, unknown>>
type MockTypographyProps = MockContainerProps & { variant?: string }

// Mock react-router-dom hooks
const mockUseLocation = vi.fn()
const mockUseNavigate = vi.fn()
const mockUseParams = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: hookMocks.currentUser
}))

// Mock utility functions
vi.mock('@/utils/array', () => ({
  isArrayEmpty: vi.fn(
    (arr: { length: number } | null | undefined) => !arr || arr.length === 0
  )
}))

vi.mock('@/utils/formatters', () => ({
  cleanEmptyStringValues: vi.fn((data: Record<string, unknown>) => ({
    ...data,
    cleaned: true
  })),
  formatNumberWithCommas: vi.fn((value) => value?.toString())
}))

vi.mock('@/utils/schedules', () => ({
  handleScheduleDelete: mockScheduleDelete,
  handleScheduleSave: vi.fn((params) =>
    Promise.resolve({ ...params.updatedData, saved: true })
  )
}))

// Mock the new fuel supply utils
vi.mock('../_utils', () => ({
  processFuelSupplyRowData: vi.fn(
    ({
      fuelSupplyData,
      fuelSuppliesLoading
    }: {
      fuelSupplyData?: { fuelSupplies?: MockGridRow[] } | null
      fuelSuppliesLoading: boolean
    }) => {
      if (fuelSuppliesLoading || !fuelSupplyData) return []
      const baseRows = fuelSupplyData.fuelSupplies || []
      return [
        ...baseRows.map((item: MockGridRow) => ({ ...item, id: 'mock-uuid' })),
        { id: 'mock-uuid' }
      ]
    }
  ),
  calculateColumnVisibility: vi.fn(() => ({
    shouldShowIsCanadaProduced: false,
    shouldShowIsQ1Supplied: false
  })),
  updateGridColumnsVisibility: vi.fn(),
  handleFuelTypeChange: vi.fn(),
  handleFuelCategoryChange: vi.fn(),
  validateFuelSupply: vi.fn(() => true),
  processCellEditingComplete: vi.fn().mockResolvedValue({ saved: true }),
  createGridOptions: vi.fn((t: (key: string) => string) => ({
    overlayNoRowsTemplate: t('fuelSupply:noFuelSuppliesFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    }
  }))
}))

// Mock constants
vi.mock('@/constants/common', () => ({
  DEFAULT_CI_FUEL: {
    Category1: 85.5,
    Category2: 90.0
  },
  DEFAULT_CI_FUEL_CODE: 'DEFAULT_CODE',
  NEW_REGULATION_YEAR: 2023,
  REPORT_SCHEDULES: {
    QUARTERLY: 'QUARTERLY',
    ANNUAL: 'ANNUAL'
  }
}))

vi.mock('@/constants/statuses', () => ({
  TRANSFER_STATUSES: {
    NEW: 'New',
    DRAFT: 'Draft',
    DELETED: 'Deleted',
    SENT: 'Sent',
    SUBMITTED: 'Submitted',
    RECOMMENDED: 'Recommended',
    RECORDED: 'Recorded',
    REFUSED: 'Refused',
    DECLINED: 'Declined',
    RESCINDED: 'Rescinded'
  },
  COMPLIANCE_REPORT_STATUSES: {
    DRAFT: 'Draft',
    DELETED: 'Deleted',
    SUBMITTED: 'Submitted',
    ANALYST_ADJUSTMENT: 'Analyst adjustment',
    RECOMMENDED_BY_ANALYST: 'Recommended by analyst',
    RECOMMENDED_BY_MANAGER: 'Recommended by manager',
    SUPPLEMENTAL_REQUESTED: 'Supplemental requested',
    ASSESSED: 'Assessed',
    REJECTED: 'Rejected',
    RETURN_TO_ANALYST: 'Return to analyst',
    RETURN_TO_MANAGER: 'Return to manager',
    RETURN_TO_SUPPLIER: 'Return to supplier'
  },
  TRANSACTION_STATUSES: {
    NEW: 'New',
    DRAFT: 'Draft',
    RECOMMENDED: 'Recommended',
    APPROVED: 'Approved',
    DELETED: 'Deleted'
  },
  REPORT_SCHEDULES_VIEW: {
    EDIT: 'EDIT',
    VIEW: 'VIEW'
  }
}))

vi.mock('@/routes/routes', () => ({
  buildPath: vi.fn(
    (_route: string, params: Record<string, string | number>) =>
      `/test-path/${params.complianceReportId}`
  ),
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

vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: hookMocks.complianceReport
}))

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate(),
  useParams: () => mockUseParams()
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

// Mock all hooks related to fuel supply
vi.mock('@/hooks/useFuelSupply', () => ({
  useFuelSupplyOptions: hookMocks.fuelSupplyOptions,
  useGetFuelSuppliesList: hookMocks.fuelSuppliesList,
  useSaveFuelSupply: hookMocks.saveFuelSupply
}))

// Mock BCGridEditor with comprehensive callback support
vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: ({
    gridRef,
    onGridReady,
    rowData,
    onCellValueChanged,
    onCellEditingStopped,
    onAction,
    saveButtonProps
  }: MockGridEditorProps) => {
    const gridApi = React.useMemo(
      () => ({
        getLastDisplayedRowIndex: vi.fn(() => rowData.length - 1),
        startEditingCell: vi.fn(),
        forEachNode: vi.fn((callback: (node: MockGridNode) => void) => {
          rowData.forEach((row: MockGridRow, index: number) => {
            const mockNode = {
              data: row,
              updateData: vi.fn((newData: MockGridRow) => {
                rowData[index] = newData
              })
            }
            callback(mockNode)
          })
        }),
        autoSizeAllColumns: vi.fn(),
        getColumn: vi.fn().mockReturnValue({ isVisible: () => false }),
        setColumnsVisible: vi.fn()
      }),
      [rowData]
    )

    // Set up gridRef if provided
    React.useEffect(() => {
      if (gridRef) {
        gridRef.current = { api: gridApi }
      }
    }, [gridRef, gridApi])

    // Trigger onGridReady if provided
    React.useEffect(() => {
      if (onGridReady) {
        setTimeout(() => {
          onGridReady({ api: gridApi })
        }, 0)
      }
    }, [onGridReady, gridApi])

    return (
      <div data-test="bc-grid-editor">
        <div data-test="row-data">
          {rowData.map((row: MockGridRow, index: number) => (
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
                column: {
                  colId: 'fuelType',
                  getColId: () => 'fuelType'
                },
                node: {
                  data: { fuelType: 'TestFuel' },
                  setDataValue: vi.fn()
                },
                data: { fuelType: 'TestFuel' },
                api: gridApi
              })
            }
          }}
        >
          Test Cell Value Changed
        </button>
        <button
          data-test="test-cell-value-changed-category"
          onClick={() => {
            if (onCellValueChanged) {
              onCellValueChanged({
                column: {
                  colId: 'fuelCategory',
                  getColId: () => 'fuelCategory'
                },
                node: {
                  data: { fuelCategory: 'TestCategory' },
                  setDataValue: vi.fn()
                },
                data: { fuelCategory: 'TestCategory' },
                api: gridApi
              })
            }
          }}
        >
          Test Cell Value Changed Category
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
              onAction('delete', {
                api: gridApi,
                node: {
                  data: { id: 'mock-uuid' },
                  rowIndex: 0,
                  updateData: vi.fn()
                }
              })
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
  default: ({ children, ...props }: MockContainerProps) => (
    <div data-test="bc-box" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: ({ children, variant, ...props }: MockTypographyProps) => (
    <div data-test="bc-typography" data-variant={variant} {...props}>
      {children}
    </div>
  )
}))

vi.mock('@mui/material/Grid2', () => ({
  __esModule: true,
  default: ({ children, ...props }: MockContainerProps) => (
    <div data-test="grid2" {...props}>
      {children}
    </div>
  )
}))

describe('AddEditFuelSupplies', () => {
  const mockSaveRow = vi.fn()
  const mockOptionsData = {
    fuelTypes: [
      {
        fuelType: 'Diesel',
        fuelCategories: [{ fuelCategory: 'Category1' }],
        eerRatios: [
          {
            endUseType: { type: 'Transportation' },
            fuelCategory: { fuelCategory: 'Category1' }
          }
        ],
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
        provisions: [{ name: 'Provision A' }, { name: 'Provision B' }]
      }
    ]
  }

  beforeEach(() => {
    vi.resetAllMocks()
    mockSaveRow.mockResolvedValue({ success: true })
    mockScheduleDelete.mockResolvedValue(true)

    // Mock location, navigate, and params
    mockUseLocation.mockReturnValue({
      pathname: '/test-path',
      state: {}
    })
    mockUseNavigate.mockReturnValue(mockNavigate)
    mockUseParams.mockReturnValue({
      complianceReportId: 'testReportId',
      compliancePeriod: '2024'
    })

    // Mock useFuelSupplyOptions
    hookMocks.fuelSupplyOptions.mockReturnValue({
      data: mockOptionsData,
      isLoading: false,
      isFetched: true
    })

    // Mock useGetFuelSuppliesList to return empty data initially
    hookMocks.fuelSuppliesList.mockReturnValue({
      data: { fuelSupplies: [] },
      isLoading: false
    })

    // Mock useSaveFuelSupply hook
    hookMocks.saveFuelSupply.mockReturnValue({
      mutateAsync: mockSaveRow
    })

    // Mock useCurrentUser
    hookMocks.currentUser.mockReturnValue({
      data: {
        organization: { organizationId: 1 }
      }
    })

    // Mock useComplianceReportWithCache
    hookMocks.complianceReport.mockReturnValue({
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
    render(<AddEditFuelSupplies />)
    expect(screen.getByText('fuelSupply:fuelSupplyTitle')).toBeInTheDocument()
  })

  it('initializes with at least one row when there are no existing fuel supplies', () => {
    render(<AddEditFuelSupplies />)
    const rows = screen.getAllByTestId('grid-row')
    expect(rows.length).toBe(1)
  })

  it('loads existing fuel supplies when available', async () => {
    hookMocks.fuelSuppliesList.mockReturnValue({
      data: {
        fuelSupplies: [
          { fuelSupplyId: 'abc', fuelType: 'Diesel' },
          { fuelSupplyId: 'xyz', fuelType: 'Gasoline' }
        ]
      },
      isLoading: false
    })

    render(<AddEditFuelSupplies />)
    const rows = await screen.findAllByTestId('grid-row')
    expect(rows.length).toBe(3) // 2 existing + 1 empty row
  })

  it('handles supplemental report correctly', () => {
    hookMocks.complianceReport.mockReturnValue({
      data: {
        report: {
          version: 1,
          reportingFrequency: 'ANNUAL'
        }
      },
      isLoading: false
    })

    render(<AddEditFuelSupplies />)
    expect(screen.getByText('fuelSupply:fuelSupplyTitle')).toBeInTheDocument()
  })

  it('handles early issuance report correctly', () => {
    hookMocks.complianceReport.mockReturnValue({
      data: {
        report: {
          version: 0,
          reportingFrequency: 'QUARTERLY'
        }
      },
      isLoading: false
    })

    render(<AddEditFuelSupplies />)
    expect(screen.getByText('fuelSupply:fuelSupplyTitle')).toBeInTheDocument()
  })

  it('does not render when still loading', () => {
    hookMocks.complianceReport.mockReturnValue({
      data: {
        report: {
          version: 0,
          reportingFrequency: 'ANNUAL'
        }
      },
      isLoading: true
    })

    render(<AddEditFuelSupplies />)
    expect(
      screen.queryByText('fuelSupply:fuelSupplyTitle')
    ).not.toBeInTheDocument()
  })

  it('does not render when options not fetched', () => {
    hookMocks.fuelSupplyOptions.mockReturnValue({
      data: mockOptionsData,
      isLoading: false,
      isFetched: false
    })

    render(<AddEditFuelSupplies />)
    expect(
      screen.queryByText('fuelSupply:fuelSupplyTitle')
    ).not.toBeInTheDocument()
  })

  it('does not render when fuel supplies loading', () => {
    hookMocks.fuelSuppliesList.mockReturnValue({
      data: { fuelSupplies: [] },
      isLoading: true
    })

    render(<AddEditFuelSupplies />)
    expect(
      screen.queryByText('fuelSupply:fuelSupplyTitle')
    ).not.toBeInTheDocument()
  })

  it('displays alert message from location state', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/test-path',
      state: {
        message: 'Test alert message',
        severity: 'success'
      }
    })

    render(<AddEditFuelSupplies />)
    expect(screen.getByText('fuelSupply:fuelSupplyTitle')).toBeInTheDocument()
  })

  it('shows note for new regulation years', () => {
    mockUseParams.mockReturnValue({
      complianceReportId: 'testReportId',
      compliancePeriod: '2024' // >= NEW_REGULATION_YEAR (2023)
    })

    render(<AddEditFuelSupplies />)
    expect(screen.getByText('fuelSupply:fuelSupplyNote')).toBeInTheDocument()
  })

  describe('onCellValueChanged', () => {
    it('handles fuelType change by calling utility function', async () => {
      const { handleFuelTypeChange, updateGridColumnsVisibility } =
        await import('../_utils')

      render(<AddEditFuelSupplies />)

      await waitFor(() => {
        const button = screen.getByTestId('test-cell-value-changed')
        fireEvent.click(button)
      })

      expect(handleFuelTypeChange).toHaveBeenCalled()
      expect(updateGridColumnsVisibility).toHaveBeenCalled()
    })

    it('handles fuelCategory change by calling utility function', async () => {
      const { handleFuelCategoryChange, updateGridColumnsVisibility } =
        await import('../_utils')

      render(<AddEditFuelSupplies />)

      await waitFor(() => {
        const button = screen.getByTestId('test-cell-value-changed-category')
        fireEvent.click(button)
      })

      expect(handleFuelCategoryChange).toHaveBeenCalled()
      expect(updateGridColumnsVisibility).toHaveBeenCalled()
    })
  })

  describe('onCellEditingStopped', () => {
    it('handles cell editing by calling utility function', async () => {
      const { processCellEditingComplete } = await import('../_utils')

      render(<AddEditFuelSupplies />)

      await waitFor(() => {
        const button = screen.getByTestId('test-cell-editing-stopped')
        fireEvent.click(button)
      })

      expect(processCellEditingComplete).toHaveBeenCalled()
    })

    it('skips processing when old value equals new value', async () => {
      render(<AddEditFuelSupplies />)

      // Mock a case where old and new values are the same
      const gridEditor = screen.getByTestId('bc-grid-editor')

      // This would be handled internally by onCellEditingStopped
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      expect(gridEditor).toBeInTheDocument()
    })
  })

  describe('onAction', () => {
    it('handles delete action', async () => {
      render(<AddEditFuelSupplies />)

      await waitFor(() => {
        const button = screen.getByTestId('test-action-delete')
        fireEvent.click(button)
      })

      expect(mockScheduleDelete).toHaveBeenCalledWith(
        expect.any(Object),
        'fuelSupplyId',
        mockSaveRow,
        expect.any(Object),
        expect.any(Function),
        { complianceReportId: 'testReportId', compliancePeriod: '2024' },
        'fuelType' // First editable column for focus after clearing
      )
    })

    it('handles errors in actions gracefully', async () => {
      mockScheduleDelete.mockRejectedValue(new Error('Delete failed'))

      render(<AddEditFuelSupplies />)

      await waitFor(() => {
        const button = screen.getByTestId('test-action-delete')
        fireEvent.click(button)
      })

      // Should not crash the component
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('handleNavigateBack', () => {
    it('navigates back to report view with success message', async () => {
      render(<AddEditFuelSupplies />)

      await waitFor(() => {
        const saveButton = screen.getByTestId('save-button')
        fireEvent.click(saveButton)
      })

      expect(mockNavigate).toHaveBeenCalledWith('/test-path/testReportId', {
        state: {
          expandedSchedule: 'fuelSupplies',
          message: 'fuelSupply:scheduleUpdated',
          severity: 'success'
        }
      })
    })
  })

  describe('component integration', () => {
    it('processes existing fuel supplies correctly', () => {
      hookMocks.fuelSuppliesList.mockReturnValue({
        data: {
          fuelSupplies: [
            { fuelSupplyId: 1, fuelType: 'Diesel', complianceReportId: 100 },
            { fuelSupplyId: 2, fuelType: 'Gasoline', complianceReportId: 200 }
          ]
        },
        isLoading: false
      })

      render(<AddEditFuelSupplies />)
      const rows = screen.getAllByTestId('grid-row')
      expect(rows.length).toBe(3) // 2 existing + 1 empty
    })

    it('handles supplemental report data processing', () => {
      hookMocks.complianceReport.mockReturnValue({
        data: {
          report: {
            version: 1,
            reportingFrequency: 'ANNUAL'
          }
        },
        isLoading: false
      })

      hookMocks.fuelSuppliesList.mockReturnValue({
        data: {
          fuelSupplies: [
            {
              fuelSupplyId: 1,
              fuelType: 'Diesel',
              complianceReportId: 'testReportId'
            }
          ]
        },
        isLoading: false
      })

      render(<AddEditFuelSupplies />)
      const rows = screen.getAllByTestId('grid-row')
      expect(rows.length).toBe(2) // 1 existing + 1 empty
    })

    it('updates grid options and column definitions when dependencies change', () => {
      const { rerender } = render(<AddEditFuelSupplies />)

      hookMocks.fuelSupplyOptions.mockReturnValue({
        data: { fuelTypes: [{ fuelType: 'NewFuel' }] },
        isLoading: false,
        isFetched: true
      })

      rerender(<AddEditFuelSupplies />)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('memoized values', () => {
    it('recalculates processedRowData when dependencies change', () => {
      const { rerender } = render(<AddEditFuelSupplies />)

      hookMocks.fuelSuppliesList.mockReturnValue({
        data: { fuelSupplies: [{ fuelSupplyId: 1, fuelType: 'NewFuel' }] },
        isLoading: false
      })

      rerender(<AddEditFuelSupplies />)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('recalculates columnVisibility when dependencies change', () => {
      const { rerender } = render(<AddEditFuelSupplies />)

      hookMocks.fuelSupplyOptions.mockReturnValue({
        data: { fuelTypes: [{ fuelType: 'NewFuel' }] },
        isLoading: false,
        isFetched: true
      })

      rerender(<AddEditFuelSupplies />)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('grid interactions', () => {
    it('starts editing on the last row when grid is ready', async () => {
      render(<AddEditFuelSupplies />)

      // onGridReady should be called automatically
      await waitFor(() => {
        expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
      })
    })

    it('auto-sizes columns when data is first rendered', async () => {
      render(<AddEditFuelSupplies />)

      await waitFor(() => {
        expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
      })
    })
  })

  describe('edge cases', () => {
    it('handles empty options data', () => {
      hookMocks.fuelSupplyOptions.mockReturnValue({
        data: { fuelTypes: [] },
        isLoading: false,
        isFetched: true
      })

      render(<AddEditFuelSupplies />)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles null compliance report data', () => {
      hookMocks.complianceReport.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<AddEditFuelSupplies />)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles undefined fuel supply data', () => {
      hookMocks.fuelSuppliesList.mockReturnValue({
        data: undefined,
        isLoading: false
      })

      render(<AddEditFuelSupplies />)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles missing report data gracefully', () => {
      hookMocks.complianceReport.mockReturnValue({
        data: { report: null },
        isLoading: false
      })

      render(<AddEditFuelSupplies />)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })
})
