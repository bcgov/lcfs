import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AddEditFuelExports } from '../AddEditFuelExports'
import { wrapper } from '@/tests/utils/wrapper'

// Mock React hooks
const mockNavigate = vi.fn()
const mockLocation = { state: null }
const mockParams = { complianceReportId: '123', compliancePeriod: '2024' }

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  useParams: () => mockParams
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock UUID
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234')
}))

// Mock utility functions
vi.mock('@/utils/array.js', () => ({
  isArrayEmpty: vi.fn()
}))

vi.mock('@/utils/schedules.js', () => ({
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
const mockUseFuelExportOptions = vi.fn()
const mockUseGetFuelExportsList = vi.fn()
const mockUseSaveFuelExport = vi.fn()
const mockUseComplianceReportWithCache = vi.fn()

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
  default: ({ children, ...props }) => <div data-test="bc-box" {...props}>{children}</div>
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, variant, ...props }) => (
    <div data-test="bc-typography" data-variant={variant} {...props}>{children}</div>
  )
}))

vi.mock('@mui/material/Grid2', () => ({
  default: ({ children, ...props }) => <div data-test="grid2" {...props}>{children}</div>
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

vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: vi.fn(({ 
    onGridReady, 
    onCellValueChanged, 
    onCellEditingStopped, 
    onAction, 
    saveButtonProps, 
    rowData = []
  }) => {
    // Simulate component lifecycle
    const { useEffect } = require('react')
    
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
        <button
          data-test="save-button"
          onClick={saveButtonProps?.onSave}
        >
          {saveButtonProps?.text || 'Save'}
        </button>
        <button
          data-test="trigger-cell-changed"
          onClick={() => onCellValueChanged && onCellValueChanged({
            column: { colId: 'fuelTypeId' },
            node: mockNode,
            data: { fuelType: 'Gasoline' },
            api: mockGridApi
          })}
        >
          Change Cell
        </button>
        <button
          data-test="trigger-cell-stopped"
          onClick={() => onCellEditingStopped && onCellEditingStopped({
            oldValue: 'old',
            newValue: 'new',
            node: mockNode
          })}
        >
          Stop Editing
        </button>
        <button
          data-test="trigger-action"
          onClick={() => onAction && onAction('delete', { node: mockNode })}
        >
          Delete
        </button>
      </div>
    )
  })
}))

describe('AddEditFuelExports', () => {
  const mockOptionsData = {
    fuelTypes: [{
      id: 1,
      fuelType: 'Gasoline',
      fuelCategories: [{ fuelCategory: 'Petroleum-based' }],
      eerRatios: [{
        endUseType: { type: 'Transport' },
        fuelCategory: { fuelCategory: 'Petroleum-based' }
      }],
      provisions: [{ name: 'Provision A' }]
    }]
  }

  const mockFuelExportsData = {
    fuelExports: [{
      id: 1,
      fuelCategory: { category: 'Petroleum-based' },
      fuelType: { fuelType: 'Gasoline' },
      provisionOfTheAct: { name: 'Provision A' },
      fuelCode: { fuelCode: 'FC001' },
      endUse: { type: 'Transport' },
      ciOfFuel: 85.5,
      complianceReportId: 123
    }]
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
    const arrayUtils = await import('@/utils/array.js')
    const scheduleUtils = await import('@/utils/schedules.js')

    arrayUtils.isArrayEmpty.mockImplementation(arr => !arr || arr.length === 0)
    scheduleUtils.handleScheduleDelete.mockResolvedValue()
    scheduleUtils.handleScheduleSave.mockResolvedValue({ saved: true })
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

      render(<AddEditFuelExports />, { wrapper })
      
      expect(screen.queryByTestId('bc-grid-editor')).not.toBeInTheDocument()
    })

    it('renders component when all data is loaded', async () => {
      render(<AddEditFuelExports />, { wrapper })

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
      expect(screen.getByText('fuelExport:addFuelExportRowsTitle')).toBeInTheDocument()
    })

    it('renders with no existing fuel export data', async () => {
      mockUseGetFuelExportsList.mockReturnValue({
        data: { fuelExports: [] },
        isLoading: false
      })

      const { isArrayEmpty } = await import('@/utils/array.js')
      isArrayEmpty.mockReturnValue(true)

      render(<AddEditFuelExports />, { wrapper })

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('renders in supplemental mode correctly', () => {
      mockUseComplianceReportWithCache.mockReturnValue({
        data: { report: { version: 1 } },
        isLoading: false
      })

      render(<AddEditFuelExports />, { wrapper })

      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('useEffect Hooks', () => {
    it('triggers alert when location state has message', async () => {
      mockLocation.state = {
        message: 'Test message',
        severity: 'success'
      }

      render(<AddEditFuelExports />, { wrapper })

      // Component should render normally even with message
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })

    it('updates column definitions when options data changes', async () => {
      const schema = await import('../_schema')

      render(<AddEditFuelExports />, { wrapper })

      expect(schema.fuelExportColDefs).toHaveBeenCalledWith(
        mockOptionsData,
        {},
        {},
        expect.any(Boolean),
        false,
        '2024'
      )
    })

    it('processes fuel exports data when loading completes', async () => {
      const { isArrayEmpty } = await import('@/utils/array.js')
      isArrayEmpty.mockReturnValue(false)

      render(<AddEditFuelExports />, { wrapper })

      // Should process the data
      expect(screen.getByTestId('bc-grid-editor')).toBeInTheDocument()
    })
  })

  describe('onGridReady Function', () => {
    it('handles grid ready with existing data', async () => {
      const { isArrayEmpty } = await import('@/utils/array.js')
      isArrayEmpty.mockReturnValue(false)

      render(<AddEditFuelExports />, { wrapper })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(mockGridApi.sizeColumnsToFit).toHaveBeenCalled()
    })

    it('handles grid ready with no data', async () => {
      const { isArrayEmpty } = await import('@/utils/array.js')
      isArrayEmpty.mockReturnValue(true)

      render(<AddEditFuelExports />, { wrapper })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(mockGridApi.sizeColumnsToFit).toHaveBeenCalled()
    })

    it('starts editing on last row after timeout', async () => {
      vi.useFakeTimers()

      render(<AddEditFuelExports />, { wrapper })

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
      render(<AddEditFuelExports />, { wrapper })

      const triggerButton = screen.getByTestId('trigger-cell-changed')
      
      await act(async () => {
        triggerButton.click()
      })

      expect(mockNode.setDataValue).toHaveBeenCalled()
    })

    it('handles fuelCategory column changes', async () => {
      render(<AddEditFuelExports />, { wrapper })

      // Mock different column
      const mockCellChangeEvent = {
        column: { colId: 'fuelCategory' },
        node: mockNode,
        data: { fuelType: 'Gasoline', fuelCategory: 'Petroleum-based' },
        api: mockGridApi
      }

      const gridEditor = screen.getByTestId('bc-grid-editor')
      const gridEditorModule = await import('@/components/BCDataGrid/BCGridEditor')
      const bcGridEditorMock = gridEditorModule.BCGridEditor
      const lastCall = bcGridEditorMock.mock.calls[bcGridEditorMock.mock.calls.length - 1]
      const onCellValueChanged = lastCall[0].onCellValueChanged

      await act(async () => {
        onCellValueChanged(mockCellChangeEvent)
      })

      expect(mockNode.setDataValue).toHaveBeenCalled()
    })

    it('handles recalculation fields', async () => {
      render(<AddEditFuelExports />, { wrapper })

      const mockRecalcEvent = {
        column: { colId: 'fuelCode' },
        node: mockNode,
        api: mockGridApi
      }

      const gridEditorModule = await import('@/components/BCDataGrid/BCGridEditor')
      const bcGridEditorMock = gridEditorModule.BCGridEditor
      const lastCall = bcGridEditorMock.mock.calls[bcGridEditorMock.mock.calls.length - 1]
      const onCellValueChanged = lastCall[0].onCellValueChanged

      await act(async () => {
        onCellValueChanged(mockRecalcEvent)
      })

      expect(mockNode.setDataValue).toHaveBeenCalledWith('ciOfFuel', null)
      expect(mockGridApi.refreshCells).toHaveBeenCalled()
    })

    it('ignores changes to non-special columns', async () => {
      render(<AddEditFuelExports />, { wrapper })

      const mockOtherEvent = {
        column: { colId: 'quantity' },
        node: mockNode,
        api: mockGridApi
      }

      const gridEditorModule = await import('@/components/BCDataGrid/BCGridEditor')
      const bcGridEditorMock = gridEditorModule.BCGridEditor
      const lastCall = bcGridEditorMock.mock.calls[bcGridEditorMock.mock.calls.length - 1]
      const onCellValueChanged = lastCall[0].onCellValueChanged

      await act(async () => {
        onCellValueChanged(mockOtherEvent)
      })

      // Should not trigger any special handling
      expect(mockGridApi.refreshCells).not.toHaveBeenCalled()
    })
  })

  describe('onCellEditingStopped Function', () => {
    it('returns early when values are unchanged', async () => {
      render(<AddEditFuelExports />, { wrapper })

      const mockUnchangedEvent = {
        oldValue: 'same',
        newValue: 'same',
        node: mockNode
      }

      const gridEditorModule = await import('@/components/BCDataGrid/BCGridEditor')
      const bcGridEditorMock = gridEditorModule.BCGridEditor
      const lastCall = bcGridEditorMock.mock.calls[bcGridEditorMock.mock.calls.length - 1]
      const onCellEditingStopped = lastCall[0].onCellEditingStopped

      await act(async () => {
        onCellEditingStopped(mockUnchangedEvent)
      })

      const { handleScheduleSave } = await import('@/utils/schedules.js')
      expect(handleScheduleSave).not.toHaveBeenCalled()
    })

    it('handles successful save scenario', async () => {
      render(<AddEditFuelExports />, { wrapper })

      const triggerButton = screen.getByTestId('trigger-cell-stopped')
      
      await act(async () => {
        triggerButton.click()
      })

      expect(mockNode.updateData).toHaveBeenCalledWith(expect.objectContaining({ 
        validationStatus: 'pending' 
      }))
    })

    it('processes save with schedule handler', async () => {
      const { handleScheduleSave } = await import('@/utils/schedules.js')
      handleScheduleSave.mockResolvedValue({ saved: true, fuelType: { fuelType: 'Processed' } })

      render(<AddEditFuelExports />, { wrapper })

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
      render(<AddEditFuelExports />, { wrapper })

      const triggerButton = screen.getByTestId('trigger-action')
      
      await act(async () => {
        triggerButton.click()
      })

      const { handleScheduleDelete } = await import('@/utils/schedules.js')
      expect(handleScheduleDelete).toHaveBeenCalled()
    })

    it('handles undo action', async () => {
      render(<AddEditFuelExports />, { wrapper })

      const mockUndoEvent = { action: 'undo', params: { node: mockNode } }

      const gridEditorModule = await import('@/components/BCDataGrid/BCGridEditor')
      const bcGridEditorMock = gridEditorModule.BCGridEditor
      const lastCall = bcGridEditorMock.mock.calls[bcGridEditorMock.mock.calls.length - 1]
      const onAction = lastCall[0].onAction

      await act(async () => {
        onAction('undo', { node: mockNode })
      })

      const { handleScheduleDelete } = await import('@/utils/schedules.js')
      expect(handleScheduleDelete).toHaveBeenCalled()
    })
  })

  describe('handleNavigateBack Function', () => {
    it('navigates back with correct parameters', async () => {
      const routesModule = await import('@/routes/routes')

      render(<AddEditFuelExports />, { wrapper })

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

      render(<AddEditFuelExports />, { wrapper })

      expect(screen.queryByTestId('bc-grid-editor')).not.toBeInTheDocument()
    })

    it('does not render when fuel exports are loading', () => {
      mockUseGetFuelExportsList.mockReturnValue({
        data: mockFuelExportsData,
        isLoading: true
      })

      render(<AddEditFuelExports />, { wrapper })

      expect(screen.queryByTestId('bc-grid-editor')).not.toBeInTheDocument()
    })

    it('does not render when compliance report is loading', () => {
      mockUseComplianceReportWithCache.mockReturnValue({
        data: mockComplianceReport,
        isLoading: true
      })

      render(<AddEditFuelExports />, { wrapper })

      expect(screen.queryByTestId('bc-grid-editor')).not.toBeInTheDocument()
    })
  })
})