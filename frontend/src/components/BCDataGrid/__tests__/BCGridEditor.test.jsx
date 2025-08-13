/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import React, { createRef, forwardRef } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { BCGridEditor } from '../BCGridEditor'
import { AgGridReact } from '@ag-grid-community/react'
import { isEqual } from '@/utils/grid/eventHandlers'
import Papa from 'papaparse'
import { v4 as uuid } from 'uuid'

// Mock AgGridReact with comprehensive API
const mockGridApi = {
  getColumnDefs: vi.fn(),
  getAllDisplayedColumns: vi.fn(),
  ensureIndexVisible: vi.fn(),
  setFocusedCell: vi.fn(),
  startEditingCell: vi.fn(),
  applyTransaction: vi.fn(),
  getDisplayedRowCount: vi.fn(),
  forEachNode: vi.fn(),
  ensureColumnVisible: vi.fn(),
  getHorizontalPixelRange: vi.fn()
}

const mockColumnApi = {}

const mockColumn = {
  colDef: { field: 'testField', editable: true },
  getColId: () => 'testField',
  left: 100,
  actualWidth: 150
}

const mockColumns = [
  { colDef: { field: 'action', editable: false }, getColId: () => 'action' },
  { colDef: { field: 'checkbox', editable: false }, getColId: () => 'checkbox' },
  mockColumn,
  { colDef: { field: 'name', editable: true }, getColId: () => 'name' }
]

vi.mock('@ag-grid-community/react', () => ({
  AgGridReact: vi.fn((props) => {
    const { onGridReady, onCellValueChanged, onCellEditingStopped, onCellClicked, onCellFocused } = props
    
    // Store callbacks for later triggering
    if (onGridReady) {
      setTimeout(() => onGridReady({ api: mockGridApi, columnApi: mockColumnApi }), 0)
    }
    
    return (
      <div 
        data-test="ag-grid-react"
        onClick={(e) => {
          if (onCellClicked) {
            onCellClicked({
              column: { colId: 'action' },
              event: {
                target: {
                  dataset: { action: 'add' }
                }
              }
            })
          }
        }}
        onFocus={(e) => {
          if (onCellFocused) {
            onCellFocused({
              column: mockColumn,
              api: mockGridApi
            })
          }
        }}
      >
        AgGrid
      </div>
    )
  })
}))

// Mock BCGridBase
vi.mock('@/components/BCDataGrid/BCGridBase', () => ({
  BCGridBase: forwardRef((props, ref) => {
    // Expose mock API through ref
    if (ref && typeof ref === 'object' && ref.current !== undefined) {
      ref.current = {
        api: mockGridApi,
        columnApi: mockColumnApi
      }
    }
    
    return <div data-test="bc-grid-base" {...props}>BCGridBase</div>
  })
}))

// Mock other components
vi.mock('@/components/BCBox', () => ({
  __esModule: true,
  default: ({ children, ...props }) => <div data-test="bc-box" {...props}>{children}</div>
}))

vi.mock('@/components/BCButton', () => ({
  __esModule: true,
  default: ({ children, ...props }) => <button data-test="bc-button" {...props}>{children}</button>
}))

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: ({ children, ...props }) => <div data-test="bc-typography" {...props}>{children}</div>
}))

vi.mock('@/components/BCModal', () => ({
  __esModule: true,
  default: ({ open, onClose, data, ...props }) => 
    open ? (
      <div data-test="bc-modal" {...props}>
        <div>{data?.title}</div>
        <div>{data?.content}</div>
        <button data-test="modal-close" onClick={onClose}>Close</button>
        <button data-test="modal-primary" onClick={data?.primaryButtonAction}>{data?.primaryButtonText}</button>
      </div>
    ) : null
}))

vi.mock('@/components/BCAlert', () => ({
  BCAlert2: forwardRef((props, ref) => {
    if (ref) {
      ref.current = {
        clearAlert: vi.fn()
      }
    }
    return <div data-test="bc-alert" {...props}>Alert</div>
  })
}))

vi.mock('@mui/material', () => ({
  Menu: ({ children, open, ...props }) => 
    open ? <div data-test="menu" {...props}>{children}</div> : null,
  MenuItem: ({ children, ...props }) => <div data-test="menu-item" {...props}>{children}</div>
}))

vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon, ...props }) => <span data-test="font-awesome-icon" {...props}>{icon.iconName}</span>
}))

vi.mock('@fortawesome/free-solid-svg-icons', () => ({
  faPlus: { iconName: 'plus' },
  faCaretDown: { iconName: 'caret-down' }
}))

// Mock react-i18next
const mockT = (key) => {
  const translations = {
    asterisk: '<span style="color: red;">*</span> indicates required fields',
    cancelBtn: 'Cancel'
  }
  return translations[key] || key
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT })
}))

// Mock utilities (already mocked in testSetup but ensuring they work)
vi.mock('@/utils/grid/eventHandlers', () => ({
  isEqual: vi.fn((a, b) => a === b)
}))

vi.mock('@/components/BCDataGrid/components', () => ({
  RequiredHeader: () => 'RequiredHeader'
}))

// Mock component for tests
const MockRequiredHeader = () => 'RequiredHeader'

// Test wrapper component
const TestWrapper = ({ children }) => {
  return <BrowserRouter>{children}</BrowserRouter>
}

describe('BCGridEditor Component', () => {
  let mockAlertRef
  let mockGridRef
  let mockOnAction
  let mockOnCellEditingStopped
  let mockOnCellValueChanged
  let mockOnGridReady
  let mockSaveButtonProps
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock implementations
    mockGridApi.getColumnDefs.mockReturnValue([])
    mockGridApi.getAllDisplayedColumns.mockReturnValue(mockColumns)
    mockGridApi.applyTransaction.mockReturnValue({ add: [{ rowIndex: 0, data: { id: 'test' } }] })
    mockGridApi.getDisplayedRowCount.mockReturnValue(5)
    mockGridApi.getHorizontalPixelRange.mockReturnValue({ left: 0, right: 1000 })
    mockGridApi.forEachNode.mockImplementation((callback) => {
      callback({ data: { validationStatus: 'valid' } })
    })
    
    // Create fresh mock refs and functions
    mockAlertRef = { current: { clearAlert: vi.fn() } }
    mockGridRef = createRef()
    mockOnAction = vi.fn()
    mockOnCellEditingStopped = vi.fn()
    mockOnCellValueChanged = vi.fn()
    mockOnGridReady = vi.fn()
    mockSaveButtonProps = {
      enabled: false,
      text: 'Save',
      onSave: vi.fn(),
      confirmText: 'Are you sure?',
      confirmLabel: 'Confirm'
    }
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(
        <TestWrapper>
          <BCGridEditor alertRef={mockAlertRef} />
        </TestWrapper>
      )
      
      expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
      expect(screen.getByTestId('bc-alert')).toBeInTheDocument()
      expect(screen.getByTestId('add-row-btn')).toBeInTheDocument()
    })
    
    it('renders with custom props', () => {
      const customProps = {
        alertRef: mockAlertRef,
        gridRef: mockGridRef,
        enablePaste: false,
        showAddRowsButton: false,
        addMultiRow: true,
        showMandatoryColumns: false,
        onGridReady: mockOnGridReady
      }
      
      render(
        <TestWrapper>
          <BCGridEditor {...customProps} />
        </TestWrapper>
      )
      
      expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
      expect(screen.queryByTestId('add-row-btn')).not.toBeInTheDocument()
    })
    
    it('renders required indicator when showMandatoryColumns is true and required columns exist', async () => {
      const columnDefs = [
        { field: 'test', headerComponent: MockRequiredHeader }
      ]
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            columnDefs={columnDefs}
            showMandatoryColumns={true}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(screen.getByTestId('bc-typography')).toBeInTheDocument()
      })
    })
    
    it('renders save button when saveButtonProps.enabled is true', () => {
      const saveProps = { ...mockSaveButtonProps, enabled: true }
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            saveButtonProps={saveProps}
          />
        </TestWrapper>
      )
      
      expect(screen.getByTestId('save-btn')).toBeInTheDocument()
    })
    
    it('renders multi-row add menu when addMultiRow is true', () => {
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            addMultiRow={true}
          />
        </TestWrapper>
      )
      
      const addButton = screen.getByTestId('add-row-btn')
      fireEvent.click(addButton)
      
      expect(screen.getByTestId('menu')).toBeInTheDocument()
      expect(screen.getAllByTestId('menu-item')).toHaveLength(3)
    })
  })

  describe('handleGridReady Function', () => {
    it('calls props.onGridReady when provided', async () => {
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            onGridReady={mockOnGridReady}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(mockOnGridReady).toHaveBeenCalledWith({
          api: mockGridApi,
          columnApi: mockColumnApi
        })
      })
    })
    
    it('sets required indicator when required columns found in grid', async () => {
      mockGridApi.getColumnDefs.mockReturnValue([
        { field: 'test', headerComponent: MockRequiredHeader }
      ])
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            showMandatoryColumns={true}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(screen.getByTestId('bc-typography')).toBeInTheDocument()
      })
    })
  })

  describe('findFirstEditableColumn Function', () => {
    it('finds first editable column excluding action and checkbox', async () => {
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
          />
        </TestWrapper>
      )
      
      // Wait for grid to be ready
      await waitFor(() => {
        expect(mockGridRef.current).toBeTruthy()
      })
      
      // Trigger findFirstEditableColumn indirectly via handleAddRowsInternal
      const addButton = screen.getByTestId('add-row-btn')
      fireEvent.click(addButton)
      
      expect(mockGridApi.getAllDisplayedColumns).toHaveBeenCalled()
    })
    
    it('returns null when no grid API available', () => {
      const { container } = render(
        <TestWrapper>
          <BCGridEditor alertRef={mockAlertRef} />
        </TestWrapper>
      )
      
      // Component should still render without errors
      expect(container).toBeTruthy()
    })
  })

  describe('startEditingFirstEditableCell Function', () => {
    it('starts editing first editable cell when grid and column available', async () => {
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(mockGridRef.current).toBeTruthy()
      })
      
      // Trigger startEditingFirstEditableCell via add row
      const addButton = screen.getByTestId('add-row-btn')
      fireEvent.click(addButton)
      
      // Wait for setTimeout to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
      })
      
      expect(mockGridApi.ensureIndexVisible).toHaveBeenCalledWith(0)
      expect(mockGridApi.setFocusedCell).toHaveBeenCalledWith(0, 'testField')
      expect(mockGridApi.startEditingCell).toHaveBeenCalledWith({
        rowIndex: 0,
        colKey: 'testField'
      })
    })
    
    it('does nothing when no grid API available', () => {
      const { container } = render(
        <TestWrapper>
          <BCGridEditor alertRef={mockAlertRef} />
        </TestWrapper>
      )
      
      // Component should render without errors
      expect(container).toBeTruthy()
    })
    
    it('does nothing when no editable column found', async () => {
      mockGridApi.getAllDisplayedColumns.mockReturnValue([
        { colDef: { field: 'action', editable: false }, getColId: () => 'action' }
      ])
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(mockGridRef.current).toBeTruthy()
      })
      
      const addButton = screen.getByTestId('add-row-btn')
      fireEvent.click(addButton)
      
      // Should not call editing functions when no editable column
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
      })
      
      expect(mockGridApi.ensureIndexVisible).not.toHaveBeenCalled()
      expect(mockGridApi.setFocusedCell).not.toHaveBeenCalled()
      expect(mockGridApi.startEditingCell).not.toHaveBeenCalled()
    })
  })

  describe('handleExcelPaste Function', () => {
    beforeEach(() => {
      // Mock clipboard data
      global.window.clipboardData = {
        getData: vi.fn(() => 'value1\tvalue2\ndata1\tdata2')
      }
    })
    
    it('processes paste data and adds rows to grid', async () => {
      Papa.parse.mockReturnValue({
        data: [
          { testField: 'data1', name: 'data2' }
        ]
      })
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
            onCellEditingStopped={mockOnCellEditingStopped}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(mockGridRef.current).toBeTruthy()
      })
      
      // Trigger paste event
      const pasteEvent = new Event('paste')
      pasteEvent.clipboardData = {
        getData: () => 'data1\tdata2'
      }
      
      fireEvent(window, pasteEvent)
      
      expect(Papa.parse).toHaveBeenCalled()
      expect(mockGridApi.applyTransaction).toHaveBeenCalledWith({
        add: expect.arrayContaining([
          expect.objectContaining({
            testField: 'data1',
            name: 'data2',
            id: 'mock-uuid-1234'
          })
        ])
      })
    })
    
    
    it('uses custom handlePaste when provided', async () => {
      const customHandlePaste = vi.fn()
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
            handlePaste={customHandlePaste}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(mockGridRef.current).toBeTruthy()
      })
      
      const pasteEvent = new Event('paste')
      pasteEvent.clipboardData = {
        getData: () => 'data1\tdata2'
      }
      
      fireEvent(window, pasteEvent)
      
      expect(customHandlePaste).toHaveBeenCalledWith(
        pasteEvent,
        { api: mockGridApi, columnApi: mockColumnApi }
      )
    })
    
    it('does not add event listener when enablePaste is false', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            enablePaste={false}
          />
        </TestWrapper>
      )
      
      expect(addEventListenerSpy).not.toHaveBeenCalledWith('paste', expect.any(Function))
    })
  })

  describe('useEffect Hooks', () => {
    it('sets required indicator when columnDefs contain RequiredHeader', async () => {
      const columnDefs = [
        { field: 'test', headerComponent: MockRequiredHeader }
      ]
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            columnDefs={columnDefs}
            showMandatoryColumns={true}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(screen.getByTestId('bc-typography')).toBeInTheDocument()
      })
    })
    
    it('does not set required indicator when showMandatoryColumns is false', () => {
      const columnDefs = [
        { field: 'test', headerComponent: MockRequiredHeader }
      ]
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            columnDefs={columnDefs}
            showMandatoryColumns={false}
          />
        </TestWrapper>
      )
      
      expect(screen.queryByTestId('bc-typography')).not.toBeInTheDocument()
    })
    
    it('does not set required indicator when no required columns found', () => {
      const columnDefs = [
        { field: 'test', headerComponent: 'StandardHeader' }
      ]
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            columnDefs={columnDefs}
            showMandatoryColumns={true}
          />
        </TestWrapper>
      )
      
      expect(screen.queryByTestId('bc-typography')).not.toBeInTheDocument()
    })
  })



  describe('Row Addition Functionality', () => {
    it('handles single row addition', async () => {
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(mockGridRef.current).toBeTruthy()
      })
      
      const addButton = screen.getByTestId('add-row-btn')
      fireEvent.click(addButton)
      
      expect(mockGridApi.applyTransaction).toHaveBeenCalledWith({
        add: [{ id: 'mock-uuid-1234' }],
        addIndex: 5
      })
    })
    
    it('handles multiple row addition via menu', async () => {
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
            addMultiRow={true}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(mockGridRef.current).toBeTruthy()
      })
      
      const addButton = screen.getByTestId('add-row-btn')
      fireEvent.click(addButton)
      
      const menuItems = screen.getAllByTestId('menu-item')
      fireEvent.click(menuItems[1]) // 5 rows
      
      expect(mockGridApi.applyTransaction).toHaveBeenCalledWith({
        add: expect.arrayContaining([
          { id: 'mock-uuid-1234' },
          { id: 'mock-uuid-1234' },
          { id: 'mock-uuid-1234' },
          { id: 'mock-uuid-1234' },
          { id: 'mock-uuid-1234' }
        ]),
        addIndex: 5
      })
    })
    
    it('uses onAction to add rows when provided', async () => {
      mockOnAction.mockResolvedValue({
        add: [{ id: 'action-row', data: {} }]
      })
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
            onAction={mockOnAction}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(mockGridRef.current).toBeTruthy()
      })
      
      const addButton = screen.getByTestId('add-row-btn')
      fireEvent.click(addButton)
      
      await waitFor(() => {
        expect(mockOnAction).toHaveBeenCalledWith('add')
      })
    })
    
    
    it('closes menu after adding rows', async () => {
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
            addMultiRow={true}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(mockGridRef.current).toBeTruthy()
      })
      
      const addButton = screen.getByTestId('add-row-btn')
      fireEvent.click(addButton)
      
      expect(screen.getByTestId('menu')).toBeInTheDocument()
      
      const menuItems = screen.getAllByTestId('menu-item')
      fireEvent.click(menuItems[0]) // 1 row
      
      // Menu should close after selection
      await waitFor(() => {
        expect(screen.queryByTestId('menu')).not.toBeInTheDocument()
      })
    })
  })

  describe('Grid Validation and Save Functionality', () => {
    it('validates grid correctly when all nodes are valid', () => {
      mockGridApi.forEachNode.mockImplementation((callback) => {
        callback({ data: { validationStatus: 'valid' } })
        callback({ data: { validationStatus: 'warning' } })
      })
      
      const saveProps = { ...mockSaveButtonProps, enabled: true }
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
            saveButtonProps={saveProps}
          />
        </TestWrapper>
      )
      
      const saveButton = screen.getByTestId('save-btn')
      fireEvent.click(saveButton)
      
      expect(saveProps.onSave).toHaveBeenCalled()
    })
    
    it('shows confirmation modal when grid has validation errors', async () => {
      mockGridApi.forEachNode.mockImplementation((callback) => {
        callback({ data: { validationStatus: 'error' } })
      })
      
      const saveProps = { ...mockSaveButtonProps, enabled: true }
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
            saveButtonProps={saveProps}
          />
        </TestWrapper>
      )
      
      const saveButton = screen.getByTestId('save-btn')
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('bc-modal')).toBeInTheDocument()
      })
      
      expect(saveProps.onSave).not.toHaveBeenCalled()
    })
    
    it('shows confirmation modal when node has no data', async () => {
      mockGridApi.forEachNode.mockImplementation((callback) => {
        callback({ data: null })
      })
      
      const saveProps = { ...mockSaveButtonProps, enabled: true }
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
            saveButtonProps={saveProps}
          />
        </TestWrapper>
      )
      
      const saveButton = screen.getByTestId('save-btn')
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('bc-modal')).toBeInTheDocument()
      })
    })
    
    it('closes confirmation modal when close button clicked', async () => {
      mockGridApi.forEachNode.mockImplementation((callback) => {
        callback({ data: { validationStatus: 'error' } })
      })
      
      const saveProps = { ...mockSaveButtonProps, enabled: true }
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
            saveButtonProps={saveProps}
          />
        </TestWrapper>
      )
      
      const saveButton = screen.getByTestId('save-btn')
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('bc-modal')).toBeInTheDocument()
      })
      
      const closeButton = screen.getByTestId('modal-close')
      fireEvent.click(closeButton)
      
      await waitFor(() => {
        expect(screen.queryByTestId('bc-modal')).not.toBeInTheDocument()
      })
    })
    
    it('calls onSave when primary button clicked in modal', async () => {
      mockGridApi.forEachNode.mockImplementation((callback) => {
        callback({ data: { validationStatus: 'error' } })
      })
      
      const saveProps = { ...mockSaveButtonProps, enabled: true }
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
            saveButtonProps={saveProps}
          />
        </TestWrapper>
      )
      
      const saveButton = screen.getByTestId('save-btn')
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('bc-modal')).toBeInTheDocument()
      })
      
      const primaryButton = screen.getByTestId('modal-primary')
      fireEvent.click(primaryButton)
      
      expect(saveProps.onSave).toHaveBeenCalled()
    })
  })

  describe('Conditional Rendering', () => {
    it('does not render required indicator when showMandatoryColumns is false', () => {
      const columnDefs = [
        { field: 'test', headerComponent: MockRequiredHeader }
      ]
      
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            columnDefs={columnDefs}
            showMandatoryColumns={false}
          />
        </TestWrapper>
      )
      
      expect(screen.queryByTestId('bc-typography')).not.toBeInTheDocument()
    })
    
    it('does not render add button when showAddRowsButton is false', () => {
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            showAddRowsButton={false}
          />
        </TestWrapper>
      )
      
      expect(screen.queryByTestId('add-row-btn')).not.toBeInTheDocument()
    })
    
    it('does not render save button when saveButtonProps.enabled is false', () => {
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            saveButtonProps={{ enabled: false }}
          />
        </TestWrapper>
      )
      
      expect(screen.queryByTestId('save-btn')).not.toBeInTheDocument()
    })
    
  })

  describe('Menu Interactions', () => {
    it('opens menu when add button clicked with addMultiRow enabled', () => {
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            addMultiRow={true}
          />
        </TestWrapper>
      )
      
      const addButton = screen.getByTestId('add-row-btn')
      fireEvent.click(addButton)
      
      expect(screen.getByTestId('menu')).toBeInTheDocument()
    })
    
    it('closes menu when clicking outside or on menu item', async () => {
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
            addMultiRow={true}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(mockGridRef.current).toBeTruthy()
      })
      
      const addButton = screen.getByTestId('add-row-btn')
      fireEvent.click(addButton)
      
      expect(screen.getByTestId('menu')).toBeInTheDocument()
      
      // Click menu item to close
      const menuItems = screen.getAllByTestId('menu-item')
      fireEvent.click(menuItems[0])
      
      await waitFor(() => {
        expect(screen.queryByTestId('menu')).not.toBeInTheDocument()
      })
    })
    
    it('adds correct number of rows based on menu selection', async () => {
      render(
        <TestWrapper>
          <BCGridEditor 
            alertRef={mockAlertRef}
            gridRef={mockGridRef}
            addMultiRow={true}
          />
        </TestWrapper>
      )
      
      await waitFor(() => {
        expect(mockGridRef.current).toBeTruthy()
      })
      
      const addButton = screen.getByTestId('add-row-btn')
      fireEvent.click(addButton)
      
      const menuItems = screen.getAllByTestId('menu-item')
      
      // Test 10 rows option
      fireEvent.click(menuItems[2])
      
      expect(mockGridApi.applyTransaction).toHaveBeenCalledWith({
        add: expect.arrayContaining(Array(10).fill({ id: 'mock-uuid-1234' })),
        addIndex: 5
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles missing gridRef gracefully', () => {
      const { container } = render(
        <TestWrapper>
          <BCGridEditor alertRef={mockAlertRef} />
        </TestWrapper>
      )
      
      expect(container).toBeTruthy()
      expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
    })
    
    it('handles missing alertRef gracefully', () => {
      const { container } = render(
        <TestWrapper>
          <BCGridEditor />
        </TestWrapper>
      )
      
      expect(container).toBeTruthy()
    })
  })
})
