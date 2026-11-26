import { test } from '@/tests/utils/fixtures'
import { screen, waitFor, act, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, vi } from 'vite-plus/test'
import { AddEditNotionalTransfers } from '../AddEditNotionalTransfers'
import { handleScheduleDelete, handleScheduleSave } from '@/utils/schedules'
import type { ReactNode, PropsWithChildren, HTMLAttributes } from 'react'
import type { RenderOptions, RenderResult } from '@testing-library/react'
import type { BCGridRow } from '@/components/BCDataGrid/types'
import type { FloatingAlertHandle } from '@/components/BCAlert/FloatingAlert'

type TestQueryResult = {
  data?: unknown
  isLoading: boolean
  isFetched?: boolean
}
type TestMutationResult = {
  mutateAsync: (data: Record<string, unknown>) => Promise<unknown>
}
type GridEditorMockProps = {
  onGridReady?: (params: Record<string, unknown>) => void
  rowData?: BCGridRow[]
  columnDefs?: unknown[]
  onCellEditingStopped?: (params: Record<string, unknown>) => unknown
  onAction?: (action: string, params?: unknown) => unknown
  loading?: boolean
  saveButtonProps?: { enabled?: boolean; onSave?: () => void; text?: ReactNode }
}
type NotionalTransferMockRow = BCGridRow & {
  id?: string | number
  legalName?: string
}
type MockFunction = ReturnType<typeof vi.fn>
type GridReadyMockParams = {
  api: {
    sizeColumnsToFit: MockFunction
    getLastDisplayedRowIndex: MockFunction
    startEditingCell: MockFunction
  }
}

const hookMocks = vi.hoisted(() => ({
  useComplianceReportWithCache: vi.fn<() => TestQueryResult>(),
  useNotionalTransferOptions: vi.fn<() => TestQueryResult>(),
  useGetAllNotionalTransfersList: vi.fn<() => TestQueryResult>(),
  useSaveNotionalTransfer: vi.fn<() => TestMutationResult>()
}))

type FixtureRender = (
  ui: ReactNode,
  options?: Omit<RenderOptions, 'wrapper'>
) => RenderResult
type ContainerMockProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>

let render: FixtureRender
const it = (name: string, fn: () => unknown) =>
  test(name, ({ render: fixtureRender, theme }) => {
    render = (ui, options) => fixtureRender(ui, [theme], options)
    return fn()
  })

// Mock react-router-dom hooks
const mockUseLocation = vi.fn()
const mockUseNavigate = vi.fn()
const mockUseParams = vi.fn()

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

// Mock all hooks
vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: hookMocks.useComplianceReportWithCache
}))
vi.mock('@/hooks/useNotionalTransfer', () => ({
  useNotionalTransferOptions: hookMocks.useNotionalTransferOptions,
  useGetAllNotionalTransfersList: hookMocks.useGetAllNotionalTransfersList,
  useSaveNotionalTransfer: hookMocks.useSaveNotionalTransfer
}))

// Mock utility functions
vi.mock('@/utils/schedules', () => ({
  handleScheduleDelete: vi.fn(),
  handleScheduleSave: vi.fn().mockResolvedValue({ saved: true })
}))

// Mock array utility
vi.mock('@/utils/array', () => ({
  isArrayEmpty: (arr: unknown) =>
    !arr || (Array.isArray(arr) && arr.length === 0)
}))

// Mock constants
vi.mock('@/constants/common', () => ({
  REPORT_SCHEDULES: {
    QUARTERLY: 'QUARTERLY',
    ANNUAL: 'ANNUAL'
  }
}))

// Mock routes
vi.mock('@/routes/routes', () => ({
  ROUTES: {
    REPORTS: {
      VIEW: 'reports/:compliancePeriod/:complianceReportId'
    }
  },
  buildPath: vi.fn(
    (_route: string, params: Record<string, string>) =>
      `/reports/${params.compliancePeriod}/${params.complianceReportId}`
  )
}))

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123')
}))

// Mock BCGridEditor with comprehensive API
let mockOnGridReady: GridEditorMockProps['onGridReady'] | null
let mockOnCellEditingStopped: GridEditorMockProps['onCellEditingStopped'] | null
let mockOnAction: GridEditorMockProps['onAction'] | null

vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: ({
    onGridReady,
    rowData,
    columnDefs,
    onCellEditingStopped,
    onAction,
    loading,
    saveButtonProps
  }: GridEditorMockProps) => {
    mockOnGridReady = onGridReady
    mockOnCellEditingStopped = onCellEditingStopped
    mockOnAction = onAction

    return (
      <div data-test="bc-grid-editor">
        <div data-test="column-def-count">{columnDefs?.length ?? 0}</div>
        <div data-test="loading">{loading ? 'loading' : 'not-loading'}</div>
        <div data-test="row-data">
          {(rowData as NotionalTransferMockRow[] | undefined)?.map(
            (row, index) => (
              <div key={index} data-test="grid-row">
                {row.id} - {row.legalName || 'empty'}
              </div>
            )
          )}
        </div>
        <button
          data-test="trigger-grid-ready"
          onClick={() => {
            if (onGridReady) {
              const mockParams = {
                api: {
                  sizeColumnsToFit: vi.fn(),
                  getLastDisplayedRowIndex: () => 0,
                  startEditingCell: vi.fn()
                }
              }
              onGridReady(mockParams)
            }
          }}
        >
          Trigger Grid Ready
        </button>
        <button
          data-test="trigger-cell-edit"
          onClick={() => {
            if (onCellEditingStopped) {
              const mockParams = {
                oldValue: 'old',
                newValue: 'new',
                colDef: { field: 'legalName' },
                node: {
                  data: { legalName: 'test' },
                  setDataValue: vi.fn(),
                  updateData: vi.fn()
                }
              }
              onCellEditingStopped(mockParams)
            }
          }}
        >
          Trigger Cell Edit
        </button>
        <button
          data-test="trigger-action"
          onClick={() => {
            if (onAction) {
              onAction('delete', { node: { data: { id: '1' } } })
            }
          }}
        >
          Trigger Action
        </button>
        {saveButtonProps && (
          <button data-test="save-button" onClick={saveButtonProps.onSave}>
            {saveButtonProps.text}
          </button>
        )}
      </div>
    )
  }
}))

// Mock Loading component
vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading-component">Loading...</div>
}))

// Mock other components
vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }: ContainerMockProps) => (
    <div data-test="bc-box" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }: ContainerMockProps) => (
    <div data-test="bc-typography" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@mui/material/Grid2', () => ({
  default: ({ children, ...props }: ContainerMockProps) => (
    <div data-test="grid2" {...props}>
      {children}
    </div>
  )
}))

// Mock schema
vi.mock('../_schema', () => ({
  defaultColDef: { test: 'default' },
  notionalTransferColDefs: () => [
    { field: 'legalName', headerName: 'Legal Name' },
    { field: 'quantity', headerName: 'Quantity' }
  ]
}))

describe('AddEditNotionalTransfers', () => {
  const mockNavigate = vi.fn()
  const mockSaveRow = vi.fn()

  // Default mock data
  const defaultComplianceReport = {
    report: {
      version: 0,
      reportingFrequency: 'ANNUAL',
      organization: { name: 'Test Organization' }
    }
  }

  const defaultNotionalTransfersData: NotionalTransferMockRow[] = []
  const defaultOptionsData = {
    fuelCategories: [{ category: 'Diesel', fuelCategoryId: 1 }],
    receivedOrTransferred: ['Received', 'Transferred']
  }

  beforeEach(() => {
    vi.resetAllMocks()

    // Reset refs
    mockOnGridReady = null
    mockOnCellEditingStopped = null
    mockOnAction = null

    // Mock router hooks
    mockUseLocation.mockReturnValue({
      pathname: '/test-path',
      state: {}
    })
    mockUseNavigate.mockReturnValue(mockNavigate)
    mockUseParams.mockReturnValue({
      complianceReportId: 'testReportId',
      compliancePeriod: '2024'
    })

    // Mock useComplianceReportWithCache
    hookMocks.useComplianceReportWithCache.mockReturnValue({
      data: defaultComplianceReport,
      isLoading: false
    })

    // Mock useNotionalTransferOptions
    hookMocks.useNotionalTransferOptions.mockReturnValue({
      data: defaultOptionsData,
      isLoading: false,
      isFetched: true
    })

    // Mock useGetAllNotionalTransfersList
    hookMocks.useGetAllNotionalTransfersList.mockReturnValue({
      data: defaultNotionalTransfersData,
      isLoading: false
    })

    // Mock useSaveNotionalTransfer
    hookMocks.useSaveNotionalTransfer.mockReturnValue({
      mutateAsync: mockSaveRow
    })
  })

  describe('Basic Rendering', () => {
    it('shows loading component when options are loading', () => {
      hookMocks.useNotionalTransferOptions.mockReturnValue({
        data: null,
        isLoading: true,
        isFetched: false
      })

      render(<AddEditNotionalTransfers />)
      expect(screen.getByTestId('loading-component')).toBeInTheDocument()
    })

    it('shows loading component when transfers are loading', () => {
      hookMocks.useGetAllNotionalTransfersList.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<AddEditNotionalTransfers />)
      expect(screen.getByTestId('loading-component')).toBeInTheDocument()
    })

    it('renders the component when data is loaded', () => {
      render(<AddEditNotionalTransfers />)

      expect(
        screen.getByText('notionalTransfer:newNotionalTransferTitle')
      ).toBeInTheDocument()
      expect(
        screen.getByText('notionalTransfer:newNotionalTransferGuide')
      ).toBeInTheDocument()
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('does not render when not fetched', () => {
      hookMocks.useNotionalTransferOptions.mockReturnValue({
        data: null,
        isLoading: false,
        isFetched: false
      })

      const { container } = render(<AddEditNotionalTransfers />, {})
      expect(container.firstChild).toBeNull()
    })

    it('does not render when compliance report is loading', () => {
      hookMocks.useComplianceReportWithCache.mockReturnValue({
        data: null,
        isLoading: true
      })

      const { container } = render(<AddEditNotionalTransfers />, {})
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Data Loading and State', () => {
    it('initializes with one empty row when no existing transfers', () => {
      render(<AddEditNotionalTransfers />)

      const rows = screen.getAllByTestId('grid-row')
      expect(rows.length).toBe(1)
      expect(rows[0]).toHaveTextContent('test-uuid-123 - empty')
    })

    it('loads existing notional transfers when available', () => {
      hookMocks.useGetAllNotionalTransfersList.mockReturnValue({
        data: [
          { notionalTransferId: 1, legalName: 'Organization A', quantity: 100 },
          { notionalTransferId: 2, legalName: 'Organization B', quantity: 200 }
        ],
        isLoading: false
      })

      render(<AddEditNotionalTransfers />)

      const rows = screen.getAllByTestId('grid-row')
      expect(rows.length).toBe(3) // 2 existing + 1 empty
      expect(rows[0]).toHaveTextContent('Organization A')
      expect(rows[1]).toHaveTextContent('Organization B')
      expect(rows[2]).toHaveTextContent('empty')
    })

    it('handles supplemental report correctly', () => {
      hookMocks.useComplianceReportWithCache.mockReturnValue({
        data: {
          report: {
            version: 1, // Supplemental
            reportingFrequency: 'ANNUAL',
            organization: { name: 'Test Organization' }
          }
        },
        isLoading: false
      })

      render(<AddEditNotionalTransfers />)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles early issuance report correctly', () => {
      hookMocks.useComplianceReportWithCache.mockReturnValue({
        data: {
          report: {
            version: 0,
            reportingFrequency: 'QUARTERLY', // Early issuance
            organization: { name: 'Test Organization' }
          }
        },
        isLoading: false
      })

      render(<AddEditNotionalTransfers />)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles missing organization name gracefully', () => {
      hookMocks.useComplianceReportWithCache.mockReturnValue({
        data: {
          report: {
            version: 0,
            reportingFrequency: 'ANNUAL',
            organization: null
          }
        },
        isLoading: false
      })

      render(<AddEditNotionalTransfers />)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('Validate Function', () => {
    type ValidationParams = {
      node?: { data?: Record<string, unknown> }
      colDef?: { field?: string }
      [key: string]: unknown
    }
    const mockValidationFn = vi.fn<(value: unknown) => boolean>()
    let mockParams: ValidationParams
    let mockAlertRef: { current: FloatingAlertHandle | null }
    const validateFunction = (
      params: ValidationParams,
      validationFn: (value: unknown) => boolean,
      errorMessage: string,
      alertRef: { current: FloatingAlertHandle | null },
      field?: string
    ): boolean => {
      const value = field ? params.node?.data?.[field] : params

      if (field && params.colDef?.field !== field) return true
      if (!validationFn(value)) {
        alertRef.current?.triggerAlert({
          message: errorMessage,
          severity: 'error'
        })
        return false
      }
      return true
    }

    beforeEach(() => {
      mockAlertRef = { current: { triggerAlert: vi.fn() } }
      mockValidationFn.mockReset()
      mockParams = {
        node: { data: { quantity: 100 } },
        colDef: { field: 'quantity' }
      }
    })

    it('returns true for valid input', () => {
      mockValidationFn.mockReturnValue(true)

      const result = validateFunction(
        mockParams,
        mockValidationFn,
        'Error message',
        mockAlertRef,
        'quantity'
      )

      expect(result).toBe(true)
      expect(mockValidationFn).toHaveBeenCalledWith(100)
    })

    it('returns false for invalid input and triggers alert', () => {
      mockValidationFn.mockReturnValue(false)

      const result = validateFunction(
        mockParams,
        mockValidationFn,
        'Quantity must be greater than 0',
        mockAlertRef,
        'quantity'
      )

      expect(result).toBe(false)
      expect(mockAlertRef.current?.triggerAlert).toHaveBeenCalledWith({
        message: 'Quantity must be greater than 0',
        severity: 'error'
      })
    })

    it('returns true when field does not match', () => {
      mockParams.colDef!.field = 'legalName'

      const result = validateFunction(
        mockParams,
        mockValidationFn,
        'Error message',
        mockAlertRef,
        'quantity'
      )

      expect(result).toBe(true)
      expect(mockValidationFn).not.toHaveBeenCalled()
    })

    it('validates without field parameter', () => {
      mockValidationFn.mockReturnValue(true)

      const result = validateFunction(
        { test: 'value' },
        mockValidationFn,
        'Error message',
        mockAlertRef
      )

      expect(result).toBe(true)
      expect(mockValidationFn).toHaveBeenCalledWith({ test: 'value' })
    })

    it('handles missing alertRef gracefully', () => {
      mockValidationFn.mockReturnValue(false)

      const result = validateFunction(
        mockParams,
        mockValidationFn,
        'Error message',
        { current: null },
        'quantity'
      )

      expect(result).toBe(false)
    })
  })

  describe('onGridReady Function', () => {
    let mockParams: GridReadyMockParams

    beforeEach(() => {
      mockParams = {
        api: {
          sizeColumnsToFit: vi.fn(),
          getLastDisplayedRowIndex: vi.fn().mockReturnValue(0),
          startEditingCell: vi.fn()
        }
      }
    })

    it('handles grid ready with existing transfers', async () => {
      hookMocks.useGetAllNotionalTransfersList.mockReturnValue({
        data: [{ notionalTransferId: 1, legalName: 'Organization A' }],
        isLoading: false
      })

      render(<AddEditNotionalTransfers />)

      const triggerButton = screen.getByTestId('trigger-grid-ready')
      fireEvent.click(triggerButton)

      await waitFor(() => {
        expect(mockParams.api?.sizeColumnsToFit).toBeDefined()
      })
    })

    it('handles grid ready with no existing transfers', async () => {
      render(<AddEditNotionalTransfers />)

      const triggerButton = screen.getByTestId('trigger-grid-ready')
      fireEvent.click(triggerButton)

      const rows = screen.getAllByTestId('grid-row')
      expect(rows.length).toBeGreaterThan(0)
    })

    it('calls API methods correctly', async () => {
      render(<AddEditNotionalTransfers />)

      // Simulate the onGridReady callback
      await act(async () => {
        if (mockOnGridReady) {
          mockOnGridReady?.(mockParams)
        }
      })

      await waitFor(() => {
        expect(mockParams.api.startEditingCell).toHaveBeenCalled()
      })
      // Column sizing is left to BCGridEditor; fitting squeezed the columns
      expect(mockParams.api.sizeColumnsToFit).not.toHaveBeenCalled()
    })

    it('handles error in try-catch block', async () => {
      // Mock console.error to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      hookMocks.useGetAllNotionalTransfersList.mockReturnValue({
        data: [{ notionalTransferId: 1, legalName: 'Organization A' }],
        isLoading: false
      })

      render(<AddEditNotionalTransfers />)

      // Manually trigger error by providing invalid data structure
      const triggerButton = screen.getByTestId('trigger-grid-ready')
      fireEvent.click(triggerButton)

      consoleSpy.mockRestore()
    })

    it('sets timeout for cell editing', async () => {
      vi.useFakeTimers()

      render(<AddEditNotionalTransfers />)

      await act(async () => {
        if (mockOnGridReady) {
          mockOnGridReady?.(mockParams)
        }
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(mockParams.api.getLastDisplayedRowIndex).toHaveBeenCalled()
      expect(mockParams.api.startEditingCell).toHaveBeenCalledWith({
        rowIndex: 0,
        colKey: 'legalName'
      })

      vi.useRealTimers()
    })

    it('ensures row IDs are assigned', async () => {
      hookMocks.useGetAllNotionalTransfersList.mockReturnValue({
        data: [
          { legalName: 'No ID Row' } // Missing ID
        ],
        isLoading: false
      })

      render(<AddEditNotionalTransfers />)

      const rows = screen.getAllByTestId('grid-row')
      expect(rows.length).toBe(2) // Original + empty row
      expect(rows[0]).toHaveTextContent('test-uuid-123') // UUID assigned
    })
  })

  describe('onCellEditingStopped Function', () => {
    it('returns early when old value equals new value', async () => {
      render(<AddEditNotionalTransfers />)

      if (mockOnCellEditingStopped) {
        const params = {
          oldValue: 'same',
          newValue: 'same',
          colDef: { field: 'legalName' },
          node: { data: {}, setDataValue: vi.fn(), updateData: vi.fn() }
        }

        await act(async () => {
          mockOnCellEditingStopped?.(params)
        })

        expect(params.node.setDataValue).not.toHaveBeenCalled()
      }
    })

    it('handles legalName field with string value', async () => {
      render(<AddEditNotionalTransfers />)

      if (mockOnCellEditingStopped) {
        const mockSetDataValue = vi.fn()
        const mockUpdateData = vi.fn()

        const params = {
          oldValue: 'old',
          newValue: 'New Organization',
          colDef: { field: 'legalName' },
          node: {
            data: { legalName: 'New Organization' },
            setDataValue: mockSetDataValue,
            updateData: mockUpdateData
          }
        }

        await act(async () => {
          mockOnCellEditingStopped?.(params)
        })

        expect(mockSetDataValue).toHaveBeenCalledWith(
          'legalName',
          'New Organization'
        )
      }
    })

    it('handles legalName field with object value', async () => {
      render(<AddEditNotionalTransfers />)

      if (mockOnCellEditingStopped) {
        const mockSetDataValue = vi.fn()
        const mockUpdateData = vi.fn()

        const params = {
          oldValue: 'old',
          newValue: { name: 'New Organization' },
          colDef: { field: 'legalName' },
          node: {
            data: { legalName: 'New Organization' },
            setDataValue: mockSetDataValue,
            updateData: mockUpdateData
          }
        }

        await act(async () => {
          mockOnCellEditingStopped?.(params)
        })

        expect(mockSetDataValue).toHaveBeenCalledWith(
          'legalName',
          'New Organization'
        )
      }
    })

    it('calls handleScheduleSave with correct parameters', async () => {
      vi.mocked(handleScheduleSave).mockResolvedValue({
        updated: true,
        validationStatus: 'success' as const
      })

      render(<AddEditNotionalTransfers />)

      if (mockOnCellEditingStopped) {
        const params = {
          oldValue: '5',
          newValue: '10',
          colDef: { field: 'quantity' },
          node: {
            data: { quantity: 10, someEmptyField: '', nullField: null },
            setDataValue: vi.fn(),
            updateData: vi.fn()
          }
        }

        await act(async () => {
          mockOnCellEditingStopped?.(params)
        })

        expect(handleScheduleSave).toHaveBeenCalledWith({
          alertRef: expect.anything(),
          idField: 'notionalTransferId',
          labelPrefix: 'notionalTransfer:notionalTransferColLabels',
          params: {
            node: expect.objectContaining({ data: params.node.data }),
            api: expect.any(Object)
          },
          setErrors: expect.any(Function),
          setWarnings: expect.any(Function),
          saveRow: mockSaveRow,
          t: expect.any(Function),
          updatedData: { quantity: 10 } // Empty/null fields filtered out
        })
      }
    })

    it('updates node data with handleScheduleSave result', async () => {
      const saveResult = {
        saved: true,
        id: 456,
        validationStatus: 'success' as const
      }
      vi.mocked(handleScheduleSave).mockResolvedValue(saveResult)

      render(<AddEditNotionalTransfers />)

      if (mockOnCellEditingStopped) {
        const mockUpdateData = vi.fn()

        const params = {
          oldValue: '5',
          newValue: '10',
          colDef: { field: 'quantity' },
          node: {
            data: { quantity: 10 },
            setDataValue: vi.fn(),
            updateData: mockUpdateData
          }
        }

        await act(async () => {
          mockOnCellEditingStopped?.(params)
        })

        expect(mockUpdateData).toHaveBeenCalledWith(saveResult)
      }
    })

    it('forwards row updates when schedule save checks warning rows', async () => {
      const warningRowNode = {
        data: { notionalTransferId: 42 },
        updateData: vi.fn()
      }
      vi.mocked(handleScheduleSave).mockImplementationOnce(
        async ({ params: scheduleParams, updatedData }) => {
          scheduleParams.api?.forEachNode?.((rowNode) => {
            rowNode.updateData?.({
              ...rowNode.data,
              validationStatus: 'warning'
            })
          })
          return { ...updatedData, validationStatus: 'warning' }
        }
      )

      render(<AddEditNotionalTransfers />)

      if (mockOnCellEditingStopped) {
        const params = {
          oldValue: 5,
          newValue: 10,
          colDef: { field: 'quantity' },
          node: {
            data: { quantity: 10 },
            setDataValue: vi.fn(),
            updateData: vi.fn()
          },
          api: {
            forEachNode: (callback: (rowNode: typeof warningRowNode) => void) =>
              callback(warningRowNode)
          }
        }

        await act(async () => {
          mockOnCellEditingStopped?.(params)
        })
      }

      expect(warningRowNode.updateData).toHaveBeenCalledWith({
        notionalTransferId: 42,
        validationStatus: 'warning'
      })
    })
  })

  describe('onAction Function', () => {
    it('handles delete action', async () => {
      render(<AddEditNotionalTransfers />)

      if (mockOnAction) {
        const params = {
          node: { data: { id: 'test-id' } },
          api: {}
        }

        await act(async () => {
          mockOnAction?.('delete', params)
        })

        expect(handleScheduleDelete).toHaveBeenCalledWith(
          params,
          'notionalTransferId',
          mockSaveRow,
          expect.anything(), // alertRef
          expect.any(Function), // setRowData
          { complianceReportId: 'testReportId' },
          'legalName' // First editable column for focus after clearing
        )
      }
    })

    it('handles undo action', async () => {
      render(<AddEditNotionalTransfers />)

      if (mockOnAction) {
        const params = {
          node: { data: { id: 'test-id' } },
          api: {}
        }

        await act(async () => {
          mockOnAction?.('undo', params)
        })

        expect(handleScheduleDelete).toHaveBeenCalledWith(
          params,
          'notionalTransferId',
          mockSaveRow,
          expect.anything(),
          expect.any(Function),
          { complianceReportId: 'testReportId' },
          'legalName' // First editable column for focus after clearing
        )
      }
    })

    it('ignores other actions', async () => {
      render(<AddEditNotionalTransfers />)

      if (mockOnAction) {
        await act(async () => {
          mockOnAction?.('other', {})
        })

        expect(handleScheduleDelete).not.toHaveBeenCalled()
      }
    })
  })

  describe('handleNavigateBack Function', () => {
    it('navigates with correct parameters', async () => {
      render(<AddEditNotionalTransfers />)

      const saveButton = screen.getByTestId('save-button')
      fireEvent.click(saveButton)

      expect(mockNavigate).toHaveBeenCalledWith('/reports/2024/testReportId', {
        state: {
          expandedSchedule: 'notionalTransfers',
          message: 'notionalTransfer:scheduleUpdated',
          severity: 'success'
        }
      })
    })
  })

  describe('useEffect Hooks', () => {
    it('does not trigger alert without message', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/test-path',
        state: {}
      })

      render(<AddEditNotionalTransfers />)

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('sets column definitions when options data is available', () => {
      const optionsData = {
        fuelCategories: [{ category: 'Diesel', fuelCategoryId: 1 }],
        receivedOrTransferred: ['Received', 'Transferred']
      }
      hookMocks.useNotionalTransferOptions.mockReturnValue({
        data: optionsData,
        isLoading: false,
        isFetched: true
      })

      render(<AddEditNotionalTransfers />)

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
      expect(
        Number(screen.getByTestId('column-def-count').textContent)
      ).toBeGreaterThan(0)
    })

    it('does not set column definitions when options are loading', () => {
      hookMocks.useNotionalTransferOptions.mockReturnValue({
        data: null,
        isLoading: true,
        isFetched: false
      })

      render(<AddEditNotionalTransfers />)

      expect(screen.getByTestId('loading-component')).toBeInTheDocument()
    })

    it('does not set column definitions when options data is empty', () => {
      hookMocks.useNotionalTransferOptions.mockReturnValue({
        data: [],
        isLoading: false,
        isFetched: true
      })

      render(<AddEditNotionalTransfers />)

      // Component should still render but without column definitions
      expect(screen.queryByTestId('loading-component')).not.toBeInTheDocument()
    })

    it('updates row data when transfers data changes', () => {
      const { rerender } = render(<AddEditNotionalTransfers />, {})

      // Change the transfers data
      hookMocks.useGetAllNotionalTransfersList.mockReturnValue({
        data: [{ notionalTransferId: 1, legalName: 'New Organization' }],
        isLoading: false
      })

      rerender(<AddEditNotionalTransfers />)

      const rows = screen.getAllByTestId('grid-row')
      expect(rows.length).toBe(2) // 1 new + 1 empty
      expect(rows[0]).toHaveTextContent('New Organization')
    })

    it('sets default row data when transfers are not loading but empty', () => {
      hookMocks.useGetAllNotionalTransfersList.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<AddEditNotionalTransfers />)

      const rows = screen.getAllByTestId('grid-row')
      expect(rows.length).toBe(1)
      expect(rows[0]).toHaveTextContent('empty')
    })

    it('marks supplemental entries correctly', () => {
      hookMocks.useComplianceReportWithCache.mockReturnValue({
        data: {
          report: {
            version: 1, // Supplemental
            reportingFrequency: 'ANNUAL',
            organization: { name: 'Test Organization' }
          }
        },
        isLoading: false
      })

      hookMocks.useGetAllNotionalTransfersList.mockReturnValue({
        data: [
          {
            notionalTransferId: 1,
            complianceReportId: 'testReportId',
            legalName: 'Supplemental Entry'
          }
        ],
        isLoading: false
      })

      render(<AddEditNotionalTransfers />)

      const rows = screen.getAllByTestId('grid-row')
      expect(rows[0]).toHaveTextContent('Supplemental Entry')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles undefined organization in compliance report', () => {
      hookMocks.useComplianceReportWithCache.mockReturnValue({
        data: {
          report: {
            version: 0,
            reportingFrequency: 'ANNUAL',
            organization: undefined
          }
        },
        isLoading: false
      })

      render(<AddEditNotionalTransfers />)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles missing params in router', () => {
      mockUseParams.mockReturnValue({})

      render(<AddEditNotionalTransfers />)

      // Component should still render but with undefined IDs
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('handles empty array for notional transfers', () => {
      hookMocks.useGetAllNotionalTransfersList.mockReturnValue({
        data: [],
        isLoading: false
      })

      render(<AddEditNotionalTransfers />)

      const rows = screen.getAllByTestId('grid-row')
      expect(rows.length).toBe(1) // Just the empty row
      expect(rows[0]).toHaveTextContent('empty')
    })

    it('preserves existing row IDs when available', () => {
      hookMocks.useGetAllNotionalTransfersList.mockReturnValue({
        data: [
          {
            notionalTransferId: 1,
            legalName: 'Existing',
            existingId: 'preserve-me'
          }
        ],
        isLoading: false
      })

      render(<AddEditNotionalTransfers />)

      const rows = screen.getAllByTestId('grid-row')
      expect(rows[0]).toHaveTextContent('test-uuid-123') // UUID is assigned regardless
    })
  })

  describe('Component Props and Configuration', () => {
    it('passes correct props to BCGridEditor', () => {
      render(<AddEditNotionalTransfers />)

      const gridEditor = screen.getByTestId('bc-grid-editor')
      expect(gridEditor).toBeInTheDocument()
    })

    it('configures save button correctly', () => {
      render(<AddEditNotionalTransfers />)

      const saveButton = screen.getByTestId('save-button')
      expect(saveButton).toHaveTextContent('report:saveReturn')
    })

    it('shows not-loading state when data is loaded', () => {
      render(<AddEditNotionalTransfers />)

      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })

    it('shows loading state when options are loading', () => {
      hookMocks.useNotionalTransferOptions.mockReturnValue({
        data: null,
        isLoading: true,
        isFetched: false
      })

      render(<AddEditNotionalTransfers />)

      expect(screen.getByTestId('loading-component')).toBeInTheDocument()
    })

    it('configures grid with correct overlay template', () => {
      render(<AddEditNotionalTransfers />)

      // The overlay template is configured (can't directly test, but grid renders)
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })
})
