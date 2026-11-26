import { useEffect } from 'react'
import { screen, act } from '@testing-library/react'
import { describe, expect, vi, beforeEach } from 'vite-plus/test'
import { AddEditFuelExports } from '../AddEditFuelExports'
import { test } from '@/tests/utils/fixtures'
import type { ReactNode, PropsWithChildren, HTMLAttributes } from 'react'
import type { RenderOptions, RenderResult } from '@testing-library/react'

let render: (
  ui: ReactNode,
  options?: Omit<RenderOptions, 'wrapper'>
) => RenderResult
const it = (name: string, fn: () => unknown) =>
  test(name, ({ render: fixtureRender, theme }) => {
    render = (ui, options) => fixtureRender(ui, [theme], options)
    return fn()
  })

type HookResult = {
  data?: unknown
  isLoading?: boolean
  isFetched?: boolean
}
type MockGridEditorProps = {
  onGridReady?: (params: { api: typeof mockGridApi }) => void
  onCellValueChanged?: (params: {
    column: { getColId: () => string }
    node: typeof mockNode
    data: Record<string, unknown>
    api: typeof mockGridApi
  }) => unknown
  onCellEditingStopped?: (params: {
    oldValue: string
    newValue: string
    node: typeof mockNode
    data: Record<string, unknown>
  }) => unknown
  onAction?: (
    action: string,
    params: { node: typeof mockNode; api: typeof mockGridApi }
  ) => unknown
  saveButtonProps?: { onSave?: () => unknown; text?: ReactNode }
  rowData?: unknown[]
}
type MockContainerProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>
type MockTypographyProps = MockContainerProps & { variant?: string }

// Mock React hooks
const mockNavigate = vi.fn((..._args: unknown[]) => undefined)
const mockLocation: { state: { message?: string; severity?: string } | null } =
  {
    state: null
  }
const mockParams = { complianceReportId: '123', compliancePeriod: '2024' }

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  useParams: () => mockParams
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

// Mock UUID
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234')
}))

// Mock utility functions
vi.mock('@/utils/array', () => ({
  isArrayEmpty: vi.fn()
}))

vi.mock('@/utils/schedules', () => ({
  handleScheduleDelete: vi.fn(),
  handleScheduleSave: vi.fn()
}))

// Mock routes
vi.mock('@/routes/routes', () => ({
  ROUTES: {
    REPORTS: {
      VIEW: '/reports/view'
    }
  },
  buildPath: vi.fn(() => '/reports/view/2024/123')
}))

// Mock schema
vi.mock('../_schema', () => ({
  defaultColDef: { resizable: true },
  fuelExportColDefs: vi.fn(() => [
    { field: 'fuelType', headerName: 'Fuel Type' },
    { field: 'quantity', headerName: 'Quantity' }
  ])
}))

// Mock custom hooks
const mockUseFuelExportOptions = vi.fn<() => HookResult>()
const mockUseGetFuelExportsList = vi.fn<() => HookResult>()
const mockUseSaveFuelExport =
  vi.fn<() => { mutateAsync: (...args: unknown[]) => Promise<unknown> }>()
const mockUseComplianceReportWithCache = vi.fn<() => HookResult>()

vi.mock('@/hooks/useFuelExport', () => ({
  useFuelExportOptions: () => mockUseFuelExportOptions(),
  useGetFuelExportsList: () => mockUseGetFuelExportsList(),
  useSaveFuelExport: () => mockUseSaveFuelExport()
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: () => mockUseComplianceReportWithCache()
}))

// Mock components
vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }: MockContainerProps) => (
    <div data-test="bc-box" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, variant, ...props }: MockTypographyProps) => (
    <div data-test="bc-typography" data-variant={variant} {...props}>
      {children}
    </div>
  )
}))

vi.mock('@mui/material/Grid2', () => ({
  default: ({ children, ...props }: MockContainerProps) => (
    <div data-test="grid2" {...props}>
      {children}
    </div>
  )
}))

// Mock BCGridEditor with comprehensive functionality
const mockGridApi = {
  sizeColumnsToFit: vi.fn(),
  getLastDisplayedRowIndex: vi.fn(() => 0),
  startEditingCell: vi.fn(),
  refreshCells: vi.fn(),
  autoSizeAllColumns: vi.fn()
}

const mockNode = {
  data: { id: 'test-uuid-1234' },
  setDataValue: vi.fn(),
  updateData: vi.fn()
}
let lastGridEditorProps: MockGridEditorProps | undefined

vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: vi.fn(
    ({
      onGridReady,
      onCellValueChanged,
      onCellEditingStopped,
      onAction,
      saveButtonProps,
      rowData = []
    }: MockGridEditorProps) => {
      lastGridEditorProps = {
        onGridReady,
        onCellValueChanged,
        onCellEditingStopped,
        onAction,
        saveButtonProps,
        rowData
      }
      // Simulate component lifecycle
      useEffect(() => {
        if (onGridReady) {
          setTimeout(() => {
            onGridReady({ api: mockGridApi })
          }, 0)
        }
      }, [onGridReady])

      return (
        <div data-test="bc-grid-editor">
          <div data-test="row-data-count">{rowData.length}</div>
          <button data-test="save-button" onClick={saveButtonProps?.onSave}>
            {saveButtonProps?.text || 'Save'}
          </button>
          <button
            data-test="trigger-cell-changed"
            onClick={() =>
              onCellValueChanged &&
              onCellValueChanged({
                column: { getColId: () => 'fuelTypeId' },
                node: mockNode,
                data: { fuelType: 'Gasoline' },
                api: mockGridApi
              })
            }
          >
            Change Cell
          </button>
          <button
            data-test="trigger-cell-stopped"
            onClick={() =>
              onCellEditingStopped &&
              onCellEditingStopped({
                oldValue: 'old',
                newValue: 'new',
                node: mockNode,
                data: mockNode.data
              })
            }
          >
            Stop Editing
          </button>
          <button
            data-test="trigger-action"
            onClick={() =>
              onAction &&
              onAction('delete', { node: mockNode, api: mockGridApi })
            }
          >
            Delete
          </button>
        </div>
      )
    }
  )
}))

describe('AddEditFuelExports', () => {
  const mockOptionsData = {
    fuelTypes: [
      {
        id: 1,
        fuelType: 'Gasoline',
        fuelCategories: [{ fuelCategory: 'Petroleum-based' }],
        eerRatios: [
          {
            endUseType: { type: 'Transport' },
            fuelCategory: { fuelCategory: 'Petroleum-based' }
          }
        ],
        provisions: [{ name: 'Provision A' }]
      }
    ]
  }

  const mockFuelExportsData = {
    fuelExports: [
      {
        id: 1,
        fuelCategory: { category: 'Petroleum-based' },
        fuelType: { fuelType: 'Gasoline' },
        provisionOfTheAct: { name: 'Provision A' },
        fuelCode: { fuelCode: 'FC001' },
        endUse: { type: 'Transport' },
        ciOfFuel: 85.5,
        complianceReportId: 123
      }
    ]
  }

  const mockComplianceReport = {
    report: { version: 0 }
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.clearAllTimers()

    // Reset location state
    mockLocation.state = null

    // Setup default mock returns
    mockUseFuelExportOptions.mockReturnValue({
      data: mockOptionsData,
      isLoading: false,
      isFetched: true
    })

    mockUseGetFuelExportsList.mockReturnValue({
      data: mockFuelExportsData,
      isLoading: false
    })

    mockUseSaveFuelExport.mockReturnValue({
      mutateAsync: vi.fn()
    })

    mockUseComplianceReportWithCache.mockReturnValue({
      data: mockComplianceReport,
      isLoading: false
    })

    // Setup mocked utility functions
    const arrayUtils = await import('@/utils/array')
    const scheduleUtils = await import('@/utils/schedules')

    vi.mocked(arrayUtils.isArrayEmpty).mockImplementation(
      (value) => Array.isArray(value) && value.length === 0
    )
    vi.mocked(scheduleUtils.handleScheduleDelete).mockResolvedValue(false)
    vi.mocked(scheduleUtils.handleScheduleSave).mockResolvedValue({
      saved: true,
      validationStatus: 'success'
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('Basic Rendering', () => {
    it('renders loading state when data is not ready', () => {
      mockUseFuelExportOptions.mockReturnValue({
        data: null,
        isLoading: true,
        isFetched: false
      })

      render(<AddEditFuelExports />)

      expect(screen.queryByTestId('bc-grid-editor')).not.toBeInTheDocument()
    })

    it('renders component when all data is loaded', async () => {
      render(<AddEditFuelExports />)

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
      expect(
        screen.getByText('fuelExport:addFuelExportRowsTitle')
      ).toBeInTheDocument()
    })

    it('renders with no existing fuel export data', async () => {
      mockUseGetFuelExportsList.mockReturnValue({
        data: { fuelExports: [] },
        isLoading: false
      })

      const { isArrayEmpty } = await import('@/utils/array')
      vi.mocked(isArrayEmpty).mockReturnValue(true)

      render(<AddEditFuelExports />)

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('renders in supplemental mode correctly', () => {
      mockUseComplianceReportWithCache.mockReturnValue({
        data: { report: { version: 1 } },
        isLoading: false
      })

      render(<AddEditFuelExports />)

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('useEffect Hooks', () => {
    it('triggers alert when location state has message', async () => {
      mockLocation.state = {
        message: 'Test message',
        severity: 'success'
      }

      render(<AddEditFuelExports />)

      // Component should render normally even with message
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('updates column definitions when options data changes', async () => {
      const schema = await import('../_schema')

      render(<AddEditFuelExports />)

      expect(schema.fuelExportColDefs).toHaveBeenCalledWith(
        mockOptionsData,
        {},
        {},
        false,
        false
      )
    })

    it('processes fuel exports data when loading completes', async () => {
      const { isArrayEmpty } = await import('@/utils/array')
      vi.mocked(isArrayEmpty).mockReturnValue(false)

      render(<AddEditFuelExports />)

      // Should process the data
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('onGridReady Function', () => {
    it('handles grid ready with existing data', async () => {
      const { isArrayEmpty } = await import('@/utils/array')
      vi.mocked(isArrayEmpty).mockReturnValue(false)

      render(<AddEditFuelExports />)

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      expect(
        Number(screen.getByTestId('row-data-count').textContent)
      ).toBeGreaterThan(0)
      // Column sizing is left to BCGridEditor; fitting squeezed the columns
      expect(mockGridApi.sizeColumnsToFit).not.toHaveBeenCalled()
    })

    it('handles grid ready with no data', async () => {
      const { isArrayEmpty } = await import('@/utils/array')
      vi.mocked(isArrayEmpty).mockReturnValue(true)

      render(<AddEditFuelExports />)

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      expect(screen.getByTestId('row-data-count')).toHaveTextContent('1')
      expect(mockGridApi.sizeColumnsToFit).not.toHaveBeenCalled()
    })

    it('starts editing on last row after timeout', async () => {
      vi.useFakeTimers()

      render(<AddEditFuelExports />)

      await act(async () => {
        vi.advanceTimersByTime(600)
      })

      expect(mockGridApi.startEditingCell).toHaveBeenCalledWith({
        rowIndex: 0,
        colKey: 'fuelTypeId'
      })

      vi.useRealTimers()
    })
  })

  describe('onCellValueChanged Function', () => {
    it('handles fuelTypeId column changes', async () => {
      render(<AddEditFuelExports />)

      const triggerButton = screen.getByTestId('trigger-cell-changed')

      await act(async () => {
        triggerButton.click()
      })

      expect(mockNode.setDataValue).toHaveBeenCalled()
    })

    it('handles fuelCategory column changes', async () => {
      render(<AddEditFuelExports />)

      // Mock different column
      const mockCellChangeEvent = {
        column: { getColId: () => 'fuelCategory' },
        node: mockNode,
        data: { fuelType: 'Gasoline', fuelCategory: 'Petroleum-based' },
        api: mockGridApi
      }

      screen.getByTestId('bc-grid-editor')
      const onCellValueChanged = lastGridEditorProps?.onCellValueChanged

      await act(async () => {
        onCellValueChanged!(mockCellChangeEvent)
      })

      expect(mockNode.setDataValue).toHaveBeenCalled()
    })

    it('handles recalculation fields', async () => {
      render(<AddEditFuelExports />)

      const mockRecalcEvent = {
        column: { getColId: () => 'fuelCode' },
        node: mockNode,
        data: {},
        api: mockGridApi
      }

      const onCellValueChanged = lastGridEditorProps?.onCellValueChanged

      await act(async () => {
        onCellValueChanged!(mockRecalcEvent)
      })

      expect(mockNode.setDataValue).toHaveBeenCalledWith('ciOfFuel', null)
      expect(mockGridApi.refreshCells).toHaveBeenCalled()
    })

    it('ignores changes to non-special columns', async () => {
      render(<AddEditFuelExports />)

      const mockOtherEvent = {
        column: { getColId: () => 'quantity' },
        node: mockNode,
        data: {},
        api: mockGridApi
      }

      const onCellValueChanged = lastGridEditorProps?.onCellValueChanged

      await act(async () => {
        onCellValueChanged!(mockOtherEvent)
      })

      // Should not trigger any special handling
      expect(mockGridApi.refreshCells).not.toHaveBeenCalled()
    })
  })

  describe('onCellEditingStopped Function', () => {
    it('returns early when values are unchanged', async () => {
      render(<AddEditFuelExports />)

      const mockUnchangedEvent = {
        oldValue: 'same',
        newValue: 'same',
        node: mockNode,
        data: mockNode.data
      }

      const onCellEditingStopped = lastGridEditorProps?.onCellEditingStopped

      await act(async () => {
        onCellEditingStopped!(mockUnchangedEvent)
      })

      const { handleScheduleSave } = await import('@/utils/schedules')
      expect(handleScheduleSave).not.toHaveBeenCalled()
    })

    it('handles successful save scenario', async () => {
      render(<AddEditFuelExports />)

      const triggerButton = screen.getByTestId('trigger-cell-stopped')

      await act(async () => {
        triggerButton.click()
      })

      expect(mockNode.updateData).toHaveBeenCalledWith(
        expect.objectContaining({
          validationStatus: 'pending'
        })
      )
    })

    it('processes save with schedule handler', async () => {
      const { handleScheduleSave } = await import('@/utils/schedules')
      vi.mocked(handleScheduleSave).mockResolvedValue({
        saved: true,
        validationStatus: 'success',
        fuelType: { fuelType: 'Processed' }
      })

      render(<AddEditFuelExports />)

      const triggerButton = screen.getByTestId('trigger-cell-stopped')

      await act(async () => {
        triggerButton.click()
      })

      expect(handleScheduleSave).toHaveBeenCalled()
      expect(mockNode.updateData).toHaveBeenCalledTimes(2) // Once for pending, once for result
    })
  })

  describe('onAction Function', () => {
    it('handles delete action', async () => {
      render(<AddEditFuelExports />)

      const triggerButton = screen.getByTestId('trigger-action')

      await act(async () => {
        triggerButton.click()
      })

      const { handleScheduleDelete } = await import('@/utils/schedules')
      expect(handleScheduleDelete).toHaveBeenCalled()
    })

    it('handles undo action', async () => {
      render(<AddEditFuelExports />)

      const onAction = lastGridEditorProps?.onAction

      await act(async () => {
        onAction!('undo', { node: mockNode, api: mockGridApi })
      })

      const { handleScheduleDelete } = await import('@/utils/schedules')
      expect(handleScheduleDelete).toHaveBeenCalled()
    })
  })

  describe('handleNavigateBack Function', () => {
    it('navigates back with correct parameters', async () => {
      const routesModule = await import('@/routes/routes')

      render(<AddEditFuelExports />)

      const saveButton = screen.getByTestId('save-button')

      await act(async () => {
        saveButton.click()
      })

      expect(routesModule.buildPath).toHaveBeenCalledWith('/reports/view', {
        compliancePeriod: '2024',
        complianceReportId: '123'
      })
      expect(mockNavigate).toHaveBeenCalled()
    })
  })

  describe('Conditional Rendering', () => {
    it('does not render when fetching is incomplete', () => {
      mockUseFuelExportOptions.mockReturnValue({
        data: mockOptionsData,
        isLoading: false,
        isFetched: false
      })

      render(<AddEditFuelExports />)

      expect(screen.queryByTestId('bc-grid-editor')).not.toBeInTheDocument()
    })

    it('does not render when fuel exports are loading', () => {
      mockUseGetFuelExportsList.mockReturnValue({
        data: mockFuelExportsData,
        isLoading: true
      })

      render(<AddEditFuelExports />)

      expect(screen.queryByTestId('bc-grid-editor')).not.toBeInTheDocument()
    })

    it('does not render when compliance report is loading', () => {
      mockUseComplianceReportWithCache.mockReturnValue({
        data: mockComplianceReport,
        isLoading: true
      })

      render(<AddEditFuelExports />)

      expect(screen.queryByTestId('bc-grid-editor')).not.toBeInTheDocument()
    })
  })
})
