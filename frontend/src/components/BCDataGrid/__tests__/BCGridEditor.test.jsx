import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import React, { createRef } from 'react'
import { BCGridEditor } from '../BCGridEditor'

// Use global test configuration from testSetup.js (data-test attribute)

// Minimal essential mocks
vi.mock('@/utils/grid/eventHandlers', () => ({ isEqual: vi.fn((a, b) => a === b) }))
vi.mock('papaparse', () => ({ default: { parse: vi.fn(() => ({ data: [{ field: 'value' }] })) } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key === 'asterisk' ? '* denotes required field' : key }) }))

vi.mock('@/components/BCAlert', () => ({
  BCAlert2: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ clearAlert: vi.fn() }))
    return <div data-test="alert-box" />
  })
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children }) => <div data-test="bc-box">{children}</div>
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, onClick, ...props }) => (
    <button onClick={onClick} data-test={props['data-test']} {...props}>
      {children}
    </button>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, dangerouslySetInnerHTML }) => (
    <div data-test="bc-typography">{dangerouslySetInnerHTML?.__html || children}</div>
  )
}))

vi.mock('@mui/material', () => ({
  Menu: ({ children, open }) => open ? <div data-test="menu">{children}</div> : null,
  MenuItem: ({ children, onClick }) => <div data-test="menu-item" onClick={onClick}>{children}</div>,
  TextField: (props) => <input data-test="textfield" {...props} />
}))

vi.mock('@mui/material/styles', () => ({ styled: (component) => () => component }))

vi.mock('@/components/BCModal', () => ({
  default: ({ open, data }) => open ? <div data-test="bc-modal">{data?.title}</div> : null
}))

// Simplified grid API mock
const mockGridApi = {
  applyTransaction: vi.fn(() => ({ add: [{ rowIndex: 0 }] })),
  getAllDisplayedColumns: vi.fn(() => [{ colDef: { field: 'name', editable: true }, getColId: () => 'name' }]),
  forEachNode: vi.fn((callback) => callback({ data: { validationStatus: 'valid' } })),
  getColumnDefs: vi.fn(() => []),
  ensureIndexVisible: vi.fn(),
  setFocusedCell: vi.fn(),
  startEditingCell: vi.fn(),
  getDisplayedRowCount: vi.fn(() => 0)
}

vi.mock('@/components/BCDataGrid/BCGridBase', () => ({
  BCGridBase: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ api: mockGridApi, columnApi: {} }))
    
    // Prevent setTimeout errors by calling onGridReady properly
    React.useEffect(() => {
      if (props.onGridReady) {
        setTimeout(() => {
          // Check if component is still mounted before calling onGridReady
          if (ref.current) {
            props.onGridReady({ api: mockGridApi, columnApi: {} })
          }
        }, 0)
      }
    }, [props.onGridReady])
    
    return <div data-test="bc-grid-base">Grid Base</div>
  })
}))

describe('BCGridEditor - Simplified Coverage Test Suite', () => {
  let defaultProps, mockGridRef

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockGridRef = createRef()
    mockGridRef.current = { api: mockGridApi, columnApi: {} }
    
    defaultProps = {
      gridRef: mockGridRef,
      alertRef: createRef(),
      rowData: [],
      columnDefs: [{ field: 'name', editable: true }]
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Clear any pending timers to prevent memory leaks and unhandled errors
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  // Essential functionality tests
  it('renders component with basic structure', () => {
    render(<BCGridEditor {...defaultProps} />)
    
    expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
    expect(screen.getByTestId('alert-box')).toBeInTheDocument()
    expect(screen.getByTestId('add-row-btn')).toBeInTheDocument()
  })

  it('handles showAddRowsButton prop', () => {
    const { rerender } = render(<BCGridEditor {...defaultProps} showAddRowsButton={true} />)
    expect(screen.getByTestId('add-row-btn')).toBeInTheDocument()
    
    rerender(<BCGridEditor {...defaultProps} showAddRowsButton={false} />)
    expect(screen.queryByTestId('add-row-btn')).not.toBeInTheDocument()
  })

  it('executes add row functionality', async () => {
    render(<BCGridEditor {...defaultProps} addMultiRow={true} />)
    
    const addButton = screen.getByTestId('add-row-btn')
    await fireEvent.click(addButton)
    
    expect(screen.getByTestId('menu')).toBeInTheDocument()
    
    const menuItem = screen.getAllByTestId('menu-item')[0]
    await fireEvent.click(menuItem)
    
    expect(mockGridApi.applyTransaction).toHaveBeenCalled()
  })

  it('executes save functionality', async () => {
    const mockOnSave = vi.fn()
    
    render(<BCGridEditor 
      {...defaultProps}
      saveButtonProps={{ enabled: true, text: 'Save', onSave: mockOnSave }}
    />)
    
    const saveButton = screen.getByTestId('save-btn')
    await fireEvent.click(saveButton)
    
    expect(mockGridApi.forEachNode).toHaveBeenCalled()
    expect(mockOnSave).toHaveBeenCalled()
  })

  it('shows save button when enabled', () => {
    render(<BCGridEditor 
      {...defaultProps}
      saveButtonProps={{ enabled: true, text: 'Save', onSave: vi.fn() }}
    />)
    
    expect(screen.getByTestId('save-btn')).toBeInTheDocument()
  })

  it('hides save button when disabled', () => {
    render(<BCGridEditor 
      {...defaultProps}
      saveButtonProps={{ enabled: false }}
    />)
    
    expect(screen.queryByTestId('save-btn')).not.toBeInTheDocument()
  })

  it('handles various prop combinations', () => {
    render(<BCGridEditor 
      {...defaultProps}
      enablePaste={false}
      addMultiRow={true}
      showMandatoryColumns={false}
      onCellValueChanged={vi.fn()}
      onCellEditingStopped={vi.fn()}
      onAction={vi.fn()}
    />)
    
    expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
  })

  it('handles null callbacks gracefully', () => {
    render(<BCGridEditor 
      {...defaultProps}
      onCellValueChanged={null}
      onCellEditingStopped={null}
      onAction={null}
    />)
    
    expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
  })

  it('handles custom paste handler', () => {
    const mockHandlePaste = vi.fn()
    
    render(<BCGridEditor 
      {...defaultProps}
      enablePaste={true}
      handlePaste={mockHandlePaste}
    />)
    
    expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
  })

  it('shows modal for invalid grid save', async () => {
    // Mock invalid grid
    mockGridApi.forEachNode.mockImplementation((callback) => {
      callback({ data: { validationStatus: 'error' } })
    })
    
    render(<BCGridEditor 
      {...defaultProps}
      saveButtonProps={{
        enabled: true,
        text: 'Save',
        onSave: vi.fn(),
        confirmText: 'Are you sure?'
      }}
    />)
    
    const saveButton = screen.getByTestId('save-btn')
    await act(async () => {
      await fireEvent.click(saveButton)
    })
    
    expect(screen.getByTestId('bc-modal')).toBeInTheDocument()
  })

  it('covers different addMultiRow states', () => {
    const { rerender } = render(<BCGridEditor {...defaultProps} addMultiRow={true} />)
    expect(screen.getByTestId('add-row-btn')).toBeInTheDocument()
    
    rerender(<BCGridEditor {...defaultProps} addMultiRow={false} />)
    expect(screen.getByTestId('add-row-btn')).toBeInTheDocument()
  })

  it('covers enablePaste branches', () => {
    const { rerender } = render(<BCGridEditor {...defaultProps} enablePaste={true} />)
    expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
    
    rerender(<BCGridEditor {...defaultProps} enablePaste={false} />)
    expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
  })
})
