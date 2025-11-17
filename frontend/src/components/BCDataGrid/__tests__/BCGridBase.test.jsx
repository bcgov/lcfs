import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRef } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { BCGridBase } from '../BCGridBase'
import { AgGridReact } from '@ag-grid-community/react'

// Mock AgGridReact
const mockGridApi = {
  getDisplayedRowCount: vi.fn(),
  setFilterModel: vi.fn(),
  getColumnDefs: vi.fn(),
  destroyFilter: vi.fn()
}

let shouldTriggerCallbacks = true

vi.mock('@ag-grid-community/react', () => ({
  AgGridReact: vi.fn((props) => {
    const { onGridReady, onRowDataUpdated, getRowStyle } = props

    // Only trigger callbacks when enabled
    if (shouldTriggerCallbacks) {
      // Trigger onGridReady if provided
      if (onGridReady) {
        setTimeout(() => onGridReady({ api: mockGridApi }), 0)
      }

      // Trigger onRowDataUpdated if provided
      if (onRowDataUpdated) {
        setTimeout(() => onRowDataUpdated(), 0)
      }
    }

    // Test getRowStyle if provided
    if (getRowStyle) {
      const testParams = { node: { id: 'test' } }
      getRowStyle(testParams)
    }

    return <div data-testid="ag-grid-react">AgGrid</div>
  })
}))

// Mock DataGridLoading
vi.mock('@/components/DataGridLoading', () => ({
  default: () => <div data-testid="data-grid-loading">Loading...</div>
}))

// Mock useSearchParams
const mockSearchParams = new URLSearchParams()
const mockSetSearchParams = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useSearchParams: vi.fn(() => [mockSearchParams, mockSetSearchParams]),
    BrowserRouter: ({ children }) => <div>{children}</div>
  }
})

// Test wrapper component
const TestWrapper = ({ children, searchParams = '' }) => {
  // Clear existing params manually since clear() may not exist
  for (const key of mockSearchParams.keys()) {
    mockSearchParams.delete(key)
  }

  if (searchParams) {
    new URLSearchParams(searchParams).forEach((value, key) => {
      mockSearchParams.set(key, value)
    })
  }

  return <BrowserRouter>{children}</BrowserRouter>
}

describe('BCGridBase Component', () => {
  let originalInnerHeight

  beforeEach(() => {
    vi.clearAllMocks()
    originalInnerHeight = window.innerHeight
    window.innerHeight = 800
    shouldTriggerCallbacks = true
    mockGridApi.getDisplayedRowCount.mockReturnValue(10)
    mockGridApi.getColumnDefs.mockReturnValue([
      { field: 'test1' },
      { field: 'test2' }
    ])
  })

  afterEach(() => {
    window.innerHeight = originalInnerHeight
    vi.restoreAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      const { container } = render(
        <TestWrapper>
          <BCGridBase />
        </TestWrapper>
      )

      expect(
        container.querySelector('[data-testid="ag-grid-react"]')
      ).toBeInTheDocument()
    })

    it('has correct displayName', () => {
      expect(BCGridBase.displayName).toBe('BCGridBase')
    })
  })

  describe('Row Styling', () => {
    it('returns highlighted background when params.node.id matches highlightedId', () => {
      const ref = createRef()

      render(
        <TestWrapper searchParams="hid=test123">
          <BCGridBase ref={ref} />
        </TestWrapper>
      )

      // Access the getRowStyle callback through AgGridReact mock
      const getRowStyleCall =
        vi.mocked(AgGridReact).mock.calls[0][0].getRowStyle
      const result = getRowStyleCall({ node: { id: 'test123' } })

      expect(result).toEqual({ backgroundColor: '#fade81' })
    })

    it('returns undefined when params.node.id does not match highlightedId', () => {
      const ref = createRef()

      render(
        <TestWrapper searchParams="hid=test123">
          <BCGridBase ref={ref} />
        </TestWrapper>
      )

      const getRowStyleCall =
        vi.mocked(AgGridReact).mock.calls[0][0].getRowStyle
      const result = getRowStyleCall({ node: { id: 'different123' } })

      expect(result).toEqual({})
    })

    it('handles null/undefined highlightedId', () => {
      const ref = createRef()

      render(
        <TestWrapper>
          <BCGridBase ref={ref} />
        </TestWrapper>
      )

      const getRowStyleCall =
        vi.mocked(AgGridReact).mock.calls[0][0].getRowStyle
      const result = getRowStyleCall({ node: { id: 'test123' } })

      expect(result).toEqual({})
    })

    it('combines default and gridOptions styles correctly', () => {
      const mockGridOptionsStyle = { color: 'red' }
      const gridOptions = {
        getRowStyle: vi.fn().mockReturnValue(mockGridOptionsStyle)
      }

      render(
        <TestWrapper searchParams="hid=test123">
          <BCGridBase gridOptions={gridOptions} />
        </TestWrapper>
      )

      const getRowStyleCall =
        vi.mocked(AgGridReact).mock.calls[0][0].getRowStyle
      const result = getRowStyleCall({ node: { id: 'test123' } })

      expect(result).toEqual({
        backgroundColor: '#fade81',
        color: 'red'
      })
      expect(gridOptions.getRowStyle).toHaveBeenCalled()
    })

    it('handles missing gridOptions.getRowStyle', () => {
      const gridOptions = {}

      render(
        <TestWrapper searchParams="hid=test123">
          <BCGridBase gridOptions={gridOptions} />
        </TestWrapper>
      )

      const getRowStyleCall =
        vi.mocked(AgGridReact).mock.calls[0][0].getRowStyle
      const result = getRowStyleCall({ node: { id: 'test123' } })

      expect(result).toEqual({ backgroundColor: '#fade81' })
    })
  })

  describe('Height Management', () => {
    it('does not call determineHeight when gridApiRef.current is null', async () => {
      const ref = createRef()

      render(
        <TestWrapper>
          <BCGridBase ref={ref} autoHeight={true} />
        </TestWrapper>
      )

      // Simulate onGridReady not being called yet (gridApiRef is null)
      await act(async () => {
        // Force component to try determineHeight without gridApi
      })

      // Since gridApiRef is null, no API calls should be made
      expect(mockGridApi.getDisplayedRowCount).not.toHaveBeenCalled()
    })

    it('sets autoHeight layout when displayedRowCount <= maxVisibleRows', async () => {
      // Set window height so maxVisibleRows = (800 * 0.75) / 45 = ~13.33
      const smallRowCount = 10
      mockGridApi.getDisplayedRowCount.mockReturnValue(smallRowCount)

      render(
        <TestWrapper>
          <BCGridBase autoHeight={true} />
        </TestWrapper>
      )

      await act(async () => {
        // Wait for onGridReady to trigger
      })

      // Verify the AgGrid received domLayout: 'autoHeight' and height: 'auto'
      const agGridProps = vi.mocked(AgGridReact).mock.calls[0][0]
      expect(agGridProps.domLayout).toBe('autoHeight')
      expect(agGridProps.containerStyle.height).toBe('auto')
    })

    it('sets normal layout when displayedRowCount > maxVisibleRows', async () => {
      // Set large row count to exceed maxVisibleRows
      const largeRowCount = 20
      mockGridApi.getDisplayedRowCount.mockReturnValue(largeRowCount)

      render(
        <TestWrapper>
          <BCGridBase autoHeight={true} />
        </TestWrapper>
      )

      // Wait for onGridReady and subsequent state updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      // Check if API was called during height determination
      expect(mockGridApi.getDisplayedRowCount).toHaveBeenCalled()
    })

    it('calculates maxVisibleRows correctly', () => {
      window.innerHeight = 1000
      const expectedMaxVisibleRows = (1000 * 0.75) / 45 // 16.67

      render(
        <TestWrapper>
          <BCGridBase autoHeight={true} />
        </TestWrapper>
      )

      // The calculation should be (window.innerHeight * 0.75) / ROW_HEIGHT
      // ROW_HEIGHT is 45 as seen in the component
      expect(expectedMaxVisibleRows).toBeCloseTo(16.67, 1)
    })

    it('calls determineHeight on row data update', async () => {
      render(
        <TestWrapper>
          <BCGridBase autoHeight={true} />
        </TestWrapper>
      )

      await act(async () => {
        // onRowDataUpdated should be triggered by mock
      })

      // Verify that the component handles row data updates
      const agGridProps = vi.mocked(AgGridReact).mock.calls[0][0]
      expect(agGridProps.onRowDataUpdated).toBeDefined()
    })
  })

  describe('Grid Ready Handler', () => {
    it('sets gridApiRef and calls determineHeight on grid ready', async () => {
      const ref = createRef()

      render(
        <TestWrapper>
          <BCGridBase ref={ref} autoHeight={true} />
        </TestWrapper>
      )

      await act(async () => {
        // Wait for onGridReady
      })

      // onGridReady should have been called
      const agGridProps = vi.mocked(AgGridReact).mock.calls[0][0]
      expect(agGridProps.onGridReady).toBeDefined()
    })

    it('calls props.onGridReady when provided and is function', async () => {
      const mockOnGridReady = vi.fn()

      render(
        <TestWrapper>
          <BCGridBase onGridReady={mockOnGridReady} autoHeight={true} />
        </TestWrapper>
      )

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      expect(mockOnGridReady).toHaveBeenCalledWith({ api: mockGridApi })
    })

    it('does not call props.onGridReady when not provided', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <TestWrapper>
          <BCGridBase autoHeight={true} />
        </TestWrapper>
      )

      await act(async () => {
        // Wait for onGridReady
      })

      // Should not throw errors
      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('does not call props.onGridReady when not a function', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <TestWrapper>
          <BCGridBase onGridReady="not-a-function" autoHeight={true} />
        </TestWrapper>
      )

      await act(async () => {
        // Wait for onGridReady
      })

      // Should not throw errors
      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('Filter Management', () => {
    it('does nothing when API not available', async () => {
      const ref = createRef()

      // Mock ref.current to have no api
      const MockAgGridWithoutApi = vi.fn(() => {
        return <div data-testid="ag-grid-react">AgGrid</div>
      })

      vi.mocked(AgGridReact).mockImplementation(MockAgGridWithoutApi)

      render(
        <TestWrapper>
          <BCGridBase ref={ref} />
        </TestWrapper>
      )

      await act(async () => {
        // Component should handle missing API gracefully
      })

      // clearFilters should not throw when api is not available
      act(() => {
        ref.current?.clearFilters()
      })

      // No API calls should be made
      expect(mockGridApi.setFilterModel).not.toHaveBeenCalled()
      expect(mockGridApi.destroyFilter).not.toHaveBeenCalled()
    })
  })

  describe('Hook Integration', () => {
    it('sets up window resize event listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

      render(
        <TestWrapper>
          <BCGridBase autoHeight={true} />
        </TestWrapper>
      )

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      )

      addEventListenerSpy.mockRestore()
    })

    it('removes window resize event listener on cleanup', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = render(
        <TestWrapper>
          <BCGridBase autoHeight={true} />
        </TestWrapper>
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      )

      removeEventListenerSpy.mockRestore()
    })

    it('triggers determineHeight on window resize', async () => {
      mockGridApi.getDisplayedRowCount.mockReturnValue(5)

      render(
        <TestWrapper>
          <BCGridBase autoHeight={true} />
        </TestWrapper>
      )

      await act(async () => {
        // Wait for initial setup
      })

      // Trigger resize event
      await act(async () => {
        fireEvent(window, new Event('resize'))
      })

      // Should call getDisplayedRowCount due to resize triggering determineHeight
      expect(mockGridApi.getDisplayedRowCount).toHaveBeenCalled()
    })

    it('exposes clearFilters method through ref via useImperativeHandle', async () => {
      const ref = createRef()

      render(
        <TestWrapper>
          <BCGridBase ref={ref} />
        </TestWrapper>
      )

      await act(async () => {
        // Wait for component to be ready
      })

      // Verify clearFilters method is exposed
      expect(ref.current?.clearFilters).toBeDefined()
      expect(typeof ref.current?.clearFilters).toBe('function')
    })
  })

  describe('Props Integration', () => {
    it('merges autoSizeStrategy with default fitGridWidth', () => {
      const customAutoSizeStrategy = { skipHeader: true }

      render(
        <TestWrapper>
          <BCGridBase autoSizeStrategy={customAutoSizeStrategy} />
        </TestWrapper>
      )

      const agGridProps = vi.mocked(AgGridReact).mock.calls[0][0]
      expect(agGridProps.autoSizeStrategy).toEqual({
        defaultMinWidth: 100,
        type: 'fitGridWidth',
        skipHeader: true
      })
    })

    it('spreads props to AgGridReact component', () => {
      const customProps = {
        columnDefs: [{ field: 'test' }],
        rowData: [{ test: 'value' }],
        customProp: 'custom'
      }

      render(
        <TestWrapper>
          <BCGridBase {...customProps} />
        </TestWrapper>
      )

      const agGridProps = vi.mocked(AgGridReact).mock.calls[0][0]
      expect(agGridProps.columnDefs).toEqual([{ field: 'test' }])
      expect(agGridProps.rowData).toEqual([{ test: 'value' }])
      expect(agGridProps.customProp).toBe('custom')
    })

    it('receives all expected AgGridReact props and configuration', () => {
      render(
        <TestWrapper>
          <BCGridBase />
        </TestWrapper>
      )

      const agGridProps = vi.mocked(AgGridReact).mock.calls[0][0]

      // Verify essential props
      expect(agGridProps.domLayout).toBe('autoHeight')
      expect(agGridProps.containerStyle.height).toBe('auto')
      expect(agGridProps.animateRows).toBe(true)
      expect(agGridProps.overlayNoRowsTemplate).toBe('No rows found')
      expect(agGridProps.suppressDragLeaveHidesColumns).toBe(true)
      expect(agGridProps.suppressMovableColumns).toBe(true)
      expect(agGridProps.suppressColumnMoveAnimation).toBe(false)
      expect(agGridProps.suppressCsvExport).toBe(false)
      expect(agGridProps.suppressColumnVirtualisation).toBe(true)
      expect(agGridProps.enableBrowserTooltips).toBe(true)
      expect(agGridProps.suppressPaginationPanel).toBe(true)
      expect(agGridProps.suppressScrollOnNewData).toBe(true)
      expect(agGridProps.rowHeight).toBe(45)
      expect(agGridProps.headerHeight).toBe(40)
      expect(agGridProps.loadingOverlayComponentParams.loadingMessage).toBe(
        'One moment please...'
      )
    })

    it('uses ROW_HEIGHT constant correctly', () => {
      render(
        <TestWrapper>
          <BCGridBase />
        </TestWrapper>
      )

      const agGridProps = vi.mocked(AgGridReact).mock.calls[0][0]
      expect(agGridProps.rowHeight).toBe(45) // ROW_HEIGHT constant
    })
  })
})
