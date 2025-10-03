import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import React, { createRef } from 'react'
import { BCGridEditorPaginated } from '../BCGridEditorPaginated'

// Minimal essential mocks
vi.mock('@/utils/grid/eventHandlers', () => ({
  isEqual: vi.fn((a, b) => a === b)
}))
vi.mock('papaparse', () => ({
  default: { parse: vi.fn(() => ({ data: [{ field: 'value' }] })) }
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => (key === 'asterisk' ? '* denotes required field' : key)
  })
}))

vi.mock('@/components/BCAlert', () => ({
  FloatingAlert: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ clearAlert: vi.fn() }))
    return <div data-test="floating-alert" />
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
    <div data-test="bc-typography">
      {dangerouslySetInnerHTML?.__html || children}
    </div>
  )
}))

vi.mock('@mui/material', () => ({
  Menu: ({ children, open }) =>
    open ? <div data-test="menu">{children}</div> : null,
  MenuItem: ({ children, onClick }) => (
    <div data-test="menu-item" onClick={onClick}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCModal', () => ({
  default: ({ open, data }) =>
    open ? <div data-test="bc-modal">{data?.title}</div> : null
}))

vi.mock('@/components/BCDataGrid/components', () => ({
  RequiredHeader: () => <div data-test="required-header">Required</div>,
  AccessibleHeader: () => <div data-test="accessible-header">Accessible</div>,
  BCPagination: ({ handleChangePage, handleChangeRowsPerPage, ...props }) => {
    return (
      <div data-test="bc-pagination">
        <button
          data-test="page-btn"
          onClick={(e) => handleChangePage && handleChangePage(e, 1)}
        >
          Next
        </button>
        <button
          data-test="size-btn"
          onClick={(e) =>
            handleChangeRowsPerPage &&
            handleChangeRowsPerPage({ target: { value: '20' } })
          }
        >
          Size
        </button>
      </div>
    )
  }
}))

// Simplified grid API mock
const mockGridApi = {
  applyTransaction: vi.fn(() => ({ add: [{ rowIndex: 0 }] })),
  getAllDisplayedColumns: vi.fn(() => [
    { colDef: { field: 'name', editable: true }, getColId: () => 'name' }
  ]),
  forEachNode: vi.fn((callback) =>
    callback({ data: { validationStatus: 'valid' } })
  ),
  getColumnDefs: vi.fn(() => []),
  ensureIndexVisible: vi.fn(),
  setFocusedCell: vi.fn(),
  startEditingCell: vi.fn(),
  getDisplayedRowCount: vi.fn(() => 0),
  setFilterModel: vi.fn(),
  applyColumnState: vi.fn()
}

vi.mock('@/components/BCDataGrid/BCGridBase', () => ({
  BCGridBase: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ api: mockGridApi, columnApi: {} }))

    React.useEffect(() => {
      if (props.onGridReady) {
        setTimeout(() => {
          if (ref.current) {
            props.onGridReady({ api: mockGridApi, columnApi: {} })
          }
        }, 0)
      }
    }, [props.onGridReady])

    return <div data-test="bc-grid-base">Grid Base</div>
  })
}))

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn()
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
})
window.IntersectionObserver = mockIntersectionObserver

describe('BCGridEditorPaginated - Simplified Coverage Test Suite', () => {
  let defaultProps, mockGridRef, mockQueryData

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockGridRef = createRef()
    mockGridRef.current = { api: mockGridApi, columnApi: {} }

    mockQueryData = {
      data: { items: [{ id: 1, name: 'Test' }], totalCount: 1 },
      error: null,
      isError: false,
      isLoading: false
    }

    defaultProps = {
      gridRef: mockGridRef,
      alertRef: createRef(),
      columnDefs: [{ field: 'name', editable: true }],
      paginationOptions: { page: 1, size: 10, sortOrders: [], filters: [] },
      onPaginationChange: vi.fn(),
      queryData: mockQueryData,
      dataKey: 'items'
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    sessionStorage.clear()
  })

  it('renders component with basic structure', () => {
    render(<BCGridEditorPaginated {...defaultProps} />)

    expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
    expect(screen.getByTestId('floating-alert')).toBeInTheDocument()
    expect(screen.getByTestId('add-row-btn')).toBeInTheDocument()
    expect(screen.getByTestId('bc-pagination')).toBeInTheDocument()
  })

  it('hides pagination when suppressPagination is true', () => {
    render(
      <BCGridEditorPaginated {...defaultProps} suppressPagination={true} />
    )

    expect(screen.queryByTestId('bc-pagination')).not.toBeInTheDocument()
  })

  it('handles showAddRowsButton prop', () => {
    const { rerender } = render(
      <BCGridEditorPaginated {...defaultProps} showAddRowsButton={true} />
    )
    expect(screen.getByTestId('add-row-btn')).toBeInTheDocument()

    rerender(
      <BCGridEditorPaginated {...defaultProps} showAddRowsButton={false} />
    )
    expect(screen.queryByTestId('add-row-btn')).not.toBeInTheDocument()
  })

  it('executes add row functionality', async () => {
    render(<BCGridEditorPaginated {...defaultProps} addMultiRow={true} />)

    const addButton = screen.getByTestId('add-row-btn')
    await fireEvent.click(addButton)

    expect(screen.getByTestId('menu')).toBeInTheDocument()

    const menuItem = screen.getAllByTestId('menu-item')[0]
    await fireEvent.click(menuItem)

    expect(mockGridApi.applyTransaction).toHaveBeenCalled()
  })

  it('executes save functionality', async () => {
    const mockOnSave = vi.fn()

    render(
      <BCGridEditorPaginated
        {...defaultProps}
        saveButtonProps={{ enabled: true, text: 'Save', onSave: mockOnSave }}
      />
    )

    const saveButton = screen.getByTestId('save-btn')
    await fireEvent.click(saveButton)

    expect(mockGridApi.forEachNode).toHaveBeenCalled()
    expect(mockOnSave).toHaveBeenCalled()
  })

  it('restores cached pagination options', () => {
    const cachedOptions = { page: 2, size: 20, sortOrders: [], filters: [] }
    sessionStorage.setItem(
      'test-grid-pagination',
      JSON.stringify(cachedOptions)
    )

    const mockOnPaginationChange = vi.fn()

    render(
      <BCGridEditorPaginated
        {...defaultProps}
        gridKey="test-grid"
        enablePageCaching={true}
        onPaginationChange={mockOnPaginationChange}
      />
    )

    expect(mockOnPaginationChange).toHaveBeenCalledWith(
      expect.objectContaining(cachedOptions)
    )
  })

  it('handles loading state', () => {
    const loadingQueryData = { ...mockQueryData, isLoading: true }

    render(
      <BCGridEditorPaginated
        {...defaultProps}
        queryData={loadingQueryData}
        loading={true}
      />
    )

    expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
  })

  it('handles error state', () => {
    const errorQueryData = {
      ...mockQueryData,
      isError: true,
      error: new Error('Test error')
    }

    render(
      <BCGridEditorPaginated {...defaultProps} queryData={errorQueryData} />
    )

    expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
  })

  it('handles floating pagination', () => {
    render(
      <BCGridEditorPaginated
        {...defaultProps}
        enableFloatingPagination={true}
      />
    )

    expect(screen.getByTestId('bc-pagination')).toBeInTheDocument()
  })

  it('handles various prop combinations', () => {
    render(
      <BCGridEditorPaginated
        {...defaultProps}
        enablePaste={false}
        addMultiRow={true}
        showMandatoryColumns={false}
        enableExportButton={true}
        enableCopyButton={true}
        enableResetButton={true}
        onCellValueChanged={vi.fn()}
        onCellEditingStopped={vi.fn()}
        onAction={vi.fn()}
      />
    )

    expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
  })

  it('handles null callbacks gracefully', () => {
    render(
      <BCGridEditorPaginated
        {...defaultProps}
        onCellValueChanged={null}
        onCellEditingStopped={null}
        onAction={null}
        onPaginationChange={null}
      />
    )

    expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
  })

  it('handles custom pagination page size selector', () => {
    render(
      <BCGridEditorPaginated
        {...defaultProps}
        paginationPageSizeSelector={[10, 25, 50]}
      />
    )

    expect(screen.getByTestId('bc-pagination')).toBeInTheDocument()
  })

  it('handles different data keys', () => {
    const customQueryData = {
      data: { records: [{ id: 1, name: 'Test' }], totalCount: 1 },
      error: null,
      isError: false,
      isLoading: false
    }

    render(
      <BCGridEditorPaginated
        {...defaultProps}
        queryData={customQueryData}
        dataKey="records"
      />
    )

    expect(screen.getByTestId('bc-grid-base')).toBeInTheDocument()
  })
})
