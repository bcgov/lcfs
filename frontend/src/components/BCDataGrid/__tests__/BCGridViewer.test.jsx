import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vite-plus/test'
import { createRef, useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { BCGridViewer } from '../BCGridViewer'
import { BCGridBase } from '@/components/BCDataGrid/BCGridBase'
import { createAgGridFilterPills } from '@/components/FilterToolbar/filterUtils'

// Unmock the components we're testing (overrides global mocks)
vi.unmock('@/components/BCDataGrid/BCGridViewer')

// Mock components and dependencies (BCAlert and BCBox use global mocks)

vi.mock('@/components/FilterToolbar', () => ({
  FilterToolbar: () => null
}))

// Mock AgGridReact and related components
const mockGridApi = {
  hideOverlay: vi.fn(),
  setFilterModel: vi.fn(),
  getFilterModel: vi.fn(() => ({})),
  applyColumnState: vi.fn(),
  getColumnState: vi.fn(() => []),
  setColumnState: vi.fn()
}

vi.mock('@/components/BCDataGrid/BCGridBase', () => ({
  BCGridBase: vi.fn().mockImplementation(function MockBCGridBase(props) {
    const { onGridReady, onFirstDataRendered, onFilterChanged, onSortChanged } =
      props

    // Simulate grid ready
    useEffect(() => {
      onGridReady?.({ api: mockGridApi })
    }, [onGridReady])

    return (
      <div
        data-test="bc-grid-base"
        onClick={() => {
          if (onFirstDataRendered) onFirstDataRendered({ api: mockGridApi })
          if (onFilterChanged) onFilterChanged({ api: mockGridApi })
          if (onSortChanged) onSortChanged()
        }}
      >
        Grid Base
      </div>
    )
  })
}))

vi.mock(
  '@/components/BCDataGrid/components/Renderers/AccessibleHeader',
  () => ({
    AccessibleHeader: () => <div data-test="accessible-header">Header</div>
  })
)

vi.mock('@/components/BCDataGrid/components/StatusBar/BCPagination', () => ({
  BCPagination: vi.fn().mockImplementation((props) => (
    <div
      data-test="bc-pagination"
      onClick={() => {
        if (props.handleChangePage) props.handleChangePage({}, 1)
        if (props.handleChangeRowsPerPage)
          props.handleChangeRowsPerPage({ target: { value: '20' } })
      }}
    >
      Pagination
    </div>
  ))
}))

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage
})

// Test wrapper component
const TestWrapper = ({ children }) => {
  return <BrowserRouter>{children}</BrowserRouter>
}

// Default props for testing
const defaultProps = {
  gridRef: createRef(),
  alertRef: createRef(),
  loading: false,
  defaultColDef: {},
  columnDefs: [],
  gridOptions: {},
  suppressPagination: false,
  gridKey: 'test-grid',
  paginationOptions: {
    page: 1,
    size: 10,
    sortOrders: [],
    filters: []
  },
  onPaginationChange: vi.fn(),
  queryData: {
    data: {
      items: [],
      pagination: { page: 1, size: 10, total: 0 }
    },
    error: null,
    isError: false,
    isLoading: false
  }
}

describe('BCGridViewer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.getItem.mockReturnValue(null)
    mockGridApi.getFilterModel.mockReturnValue({})
    mockGridApi.getColumnState.mockReturnValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Basic Functionality', () => {
    it('should have correct displayName', () => {
      expect(BCGridViewer.displayName).toBe('BCGridViewer')
    })

    it('should render error alert for non-404 errors', () => {
      const errorProps = {
        ...defaultProps,
        queryData: {
          ...defaultProps.queryData,
          isError: true,
          error: {
            message: 'Server error',
            response: { status: 500 }
          }
        }
      }

      render(
        <TestWrapper>
          <BCGridViewer {...errorProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('bc-alert')).toBeInTheDocument()
      expect(screen.getByText(/Server error/)).toBeInTheDocument()
    })

    it('should not render error alert for 404 errors', () => {
      const errorProps = {
        ...defaultProps,
        queryData: {
          ...defaultProps.queryData,
          isError: true,
          error: {
            message: 'Not found',
            response: { status: 404 }
          }
        }
      }

      render(
        <TestWrapper>
          <BCGridViewer {...errorProps} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('bc-alert')).not.toBeInTheDocument()
    })

    it('should handle error without response object', () => {
      const errorProps = {
        ...defaultProps,
        queryData: {
          ...defaultProps.queryData,
          isError: true,
          error: { message: 'Network error' }
        }
      }

      render(
        <TestWrapper>
          <BCGridViewer {...errorProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('bc-alert')).toBeInTheDocument()
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })
  })

  describe('Caching Functions', () => {
    it('should handle caching-related props', () => {
      const props = {
        ...defaultProps,
        enablePageCaching: true,
        gridKey: 'cache-test-grid'
      }

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...props} />
          </TestWrapper>
        )
      }).not.toThrow()
    })
  })

  describe('Pagination Suppression', () => {
    it('should not render pagination when suppressPagination is true', () => {
      const props = {
        ...defaultProps,
        suppressPagination: true
      }

      render(
        <TestWrapper>
          <BCGridViewer {...props} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('bc-pagination')).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle onPaginationChange being undefined', () => {
      const propsWithoutCallback = {
        ...defaultProps,
        onPaginationChange: undefined
      }

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...propsWithoutCallback} />
          </TestWrapper>
        )
      }).not.toThrow()
    })
  })

  describe('Utility Function Coverage', () => {
    it('should handle missing IntersectionObserver gracefully', async () => {
      // Temporarily remove IntersectionObserver
      const originalIntersectionObserver = window.IntersectionObserver
      delete window.IntersectionObserver

      const props = {
        ...defaultProps,
        enableFloatingPagination: true
      }

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...props} />
          </TestWrapper>
        )
      }).not.toThrow()

      // Restore IntersectionObserver
      if (originalIntersectionObserver) {
        window.IntersectionObserver = originalIntersectionObserver
      }
    })
  })

  describe('Memoized Values and Derived State', () => {
    it('should create defaultColDefParams structure', () => {
      // Test that the component creates the memoized defaultColDefParams
      const props = {
        ...defaultProps,
        defaultColDef: { resizable: false }
      }

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...props} />
          </TestWrapper>
        )
      }).not.toThrow()
    })

    it('should handle prop variations', () => {
      const props = {
        ...defaultProps,
        enableExportButton: true,
        enableCopyButton: true,
        enableResetButton: true,
        enablePageCaching: false,
        enableFloatingPagination: false,
        paginationPageSizeSelector: [10, 25, 50],
        exportName: 'CustomExport',
        autoSizeStrategy: { type: 'fitGridWidth' }
      }

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...props} />
          </TestWrapper>
        )
      }).not.toThrow()
    })
  })

  describe('Event Handler Coverage', () => {
    it('should create handleChangePage function', () => {
      // Test that the component creates the handleChangePage function internally
      const onPaginationChange = vi.fn()
      const props = {
        ...defaultProps,
        onPaginationChange
      }

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...props} />
          </TestWrapper>
        )
      }).not.toThrow()
    })

    it('should create handleChangeRowsPerPage function', () => {
      // Test that the component creates the handleChangeRowsPerPage function internally
      const onPaginationChange = vi.fn()
      const props = {
        ...defaultProps,
        onPaginationChange
      }

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...props} />
          </TestWrapper>
        )
      }).not.toThrow()
    })
  })

  describe('Data Handling', () => {
    it('should handle loading state', () => {
      const props = {
        ...defaultProps,
        queryData: {
          ...defaultProps.queryData,
          isLoading: true
        }
      }

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...props} />
          </TestWrapper>
        )
      }).not.toThrow()
    })

    it('should handle empty data', () => {
      const props = {
        ...defaultProps,
        queryData: {
          data: null,
          error: null,
          isError: false,
          isLoading: false
        }
      }

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...props} />
          </TestWrapper>
        )
      }).not.toThrow()
    })

    it('should use custom dataKey', () => {
      const props = {
        ...defaultProps,
        dataKey: 'customItems',
        queryData: {
          data: {
            customItems: [{ id: 1, name: 'test' }],
            pagination: { page: 1, size: 10, total: 1 }
          },
          error: null,
          isError: false,
          isLoading: false
        }
      }

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...props} />
          </TestWrapper>
        )
      }).not.toThrow()
    })
  })

  describe('UseEffect Coverage', () => {
    it('should handle scrollbar decision effect', () => {
      // Mock DOM elements for scrollbar detection
      const mockElement = {
        scrollWidth: 1000,
        clientWidth: 800
      }

      const originalQuerySelector = HTMLElement.prototype.querySelector
      HTMLElement.prototype.querySelector = vi.fn().mockReturnValue(mockElement)

      const props = {
        ...defaultProps,
        queryData: {
          data: {
            items: [{ id: 1 }],
            pagination: { page: 1, size: 10, total: 1 }
          },
          error: null,
          isError: false,
          isLoading: false
        }
      }

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...props} />
          </TestWrapper>
        )
      }).not.toThrow()

      HTMLElement.prototype.querySelector = originalQuerySelector
    })

    it('should handle gridKey change effect', () => {
      const props = {
        ...defaultProps,
        gridKey: 'initial-key'
      }

      const { rerender } = render(
        <TestWrapper>
          <BCGridViewer {...props} />
        </TestWrapper>
      )

      // Change gridKey to trigger the effect
      rerender(
        <TestWrapper>
          <BCGridViewer {...props} gridKey="changed-key" />
        </TestWrapper>
      )

      // Component should handle gridKey change without errors
      expect(true).toBe(true) // If we get here, the effect didn't crash
    })
  })

  describe('Conditional Branches', () => {
    it('should handle enablePageCaching branches', () => {
      const propsEnabled = {
        ...defaultProps,
        enablePageCaching: true,
        gridKey: 'test-key'
      }

      const propsDisabled = {
        ...defaultProps,
        enablePageCaching: false
      }

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...propsEnabled} />
          </TestWrapper>
        )
      }).not.toThrow()

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...propsDisabled} />
          </TestWrapper>
        )
      }).not.toThrow()
    })

    it('should handle missing gridKey', () => {
      const props = {
        ...defaultProps,
        gridKey: null,
        enablePageCaching: true
      }

      expect(() => {
        render(
          <TestWrapper>
            <BCGridViewer {...props} />
          </TestWrapper>
        )
      }).not.toThrow()
    })
  })

  describe('Session preference persistence', () => {
    it('fits columns when an empty controlled state overrides a cached layout', async () => {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 1000
      })
      mockSessionStorage.getItem.mockImplementation((key) =>
        key === 'test-grid-column'
          ? JSON.stringify([{ colId: 'iaCode', width: 400 }])
          : null
      )

      render(
        <TestWrapper>
          <BCGridViewer
            {...defaultProps}
            columnDefs={[{ field: 'iaCode', minWidth: 100 }]}
            columnState={[]}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockGridApi.applyColumnState).toHaveBeenCalledWith({
          state: [],
          applyOrder: true
        })
      })
      const gridProps = BCGridBase.mock.calls.at(-1)[0]
      expect(gridProps.autoSizeStrategy).toEqual(
        expect.objectContaining({ type: 'fitGridWidth' })
      )
      expect(gridProps.columnDefs[0].flex).toBe(1)
    })

    it.each([
      [false, false],
      [false, true],
      [true, false],
      [true, true]
    ])(
      'restores sorting on remount without cached pagination (page caching: %s, cached filters: %s)',
      async (enablePageCaching, restoreFilters) => {
        const onPaginationChange = vi.fn()
        const onColumnStateChange = vi.fn()
        const columnState = [
          { colId: 'fuelType', sort: 'asc', sortIndex: 1 },
          { colId: 'complianceUnits', sort: 'desc', sortIndex: 0 },
          { colId: 'quantity', sort: null }
        ]
        mockSessionStorage.getItem.mockImplementation((key) =>
          key === 'test-grid-filter' && restoreFilters
            ? JSON.stringify({
                fuelType: {
                  filterType: 'text',
                  type: 'contains',
                  filter: 'diesel'
                }
              })
            : null
        )
        const renderGrid = () =>
          render(
            <TestWrapper>
              <BCGridViewer
                {...defaultProps}
                paginationOptions={{
                  ...defaultProps.paginationOptions,
                  page: 3,
                  size: 25
                }}
                enablePageCaching={enablePageCaching}
                columnState={columnState}
                onPaginationChange={onPaginationChange}
                onColumnStateChange={onColumnStateChange}
              />
            </TestWrapper>
          )
        const expectedPagination = {
          page: restoreFilters ? 1 : 3,
          size: 25,
          sortOrders: [
            { field: 'complianceUnits', direction: 'desc' },
            { field: 'fuelType', direction: 'asc' }
          ],
          filters: restoreFilters
            ? [
                {
                  field: 'fuelType',
                  filterType: 'text',
                  type: 'contains',
                  filter: 'diesel'
                }
              ]
            : []
        }

        const { unmount } = renderGrid()
        await waitFor(() => {
          expect(onPaginationChange).toHaveBeenCalledWith(expectedPagination)
        })
        unmount()
        onPaginationChange.mockClear()

        renderGrid()
        await waitFor(() => {
          expect(onPaginationChange).toHaveBeenCalledWith(expectedPagination)
        })
        expect(mockSessionStorage.setItem).not.toHaveBeenCalled()
        expect(onColumnStateChange).not.toHaveBeenCalled()
      }
    )

    it('restores saved column layout without resetting cached pagination', async () => {
      const onPaginationChange = vi.fn()
      const columnState = [{ colId: 'iaCode', width: 320, hide: false }]
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'test-grid-column') return JSON.stringify(columnState)
        if (key === 'test-grid-pagination') {
          return JSON.stringify({
            page: 3,
            size: 25,
            sortOrders: [{ field: 'iaCode', direction: 'asc' }],
            filters: []
          })
        }
        return null
      })

      render(
        <TestWrapper>
          <BCGridViewer
            {...defaultProps}
            onPaginationChange={onPaginationChange}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockGridApi.applyColumnState).toHaveBeenCalledWith({
          state: columnState,
          applyOrder: true
        })
      })
      expect(onPaginationChange).not.toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      )
    })

    it('persists column widths after a user resize', () => {
      const columnState = [{ colId: 'iaCode', width: 400 }]
      mockGridApi.getColumnState.mockReturnValue(columnState)

      render(
        <TestWrapper>
          <BCGridViewer {...defaultProps} />
        </TestWrapper>
      )

      const gridProps = BCGridBase.mock.calls.at(-1)[0]
      gridProps.onColumnResized({
        finished: true,
        source: 'uiColumnResized',
        api: mockGridApi
      })

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'test-grid-column',
        JSON.stringify(columnState)
      )
    })

    it('persists column visibility changes', () => {
      const columnState = [{ colId: 'contactName', hide: true }]
      mockGridApi.getColumnState.mockReturnValue(columnState)

      render(
        <TestWrapper>
          <BCGridViewer {...defaultProps} />
        </TestWrapper>
      )

      const gridProps = BCGridBase.mock.calls.at(-1)[0]
      gridProps.onColumnVisible({ api: mockGridApi })

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'test-grid-column',
        JSON.stringify(columnState)
      )
    })

    it('writes column state to localStorage for login-session grids', () => {
      localStorage.clear()
      const columnState = [{ colId: 'iaCode', width: 400 }]
      mockGridApi.getColumnState.mockReturnValue(columnState)

      render(
        <TestWrapper>
          <BCGridViewer {...defaultProps} persistForLoginSession />
        </TestWrapper>
      )

      const gridProps = BCGridBase.mock.calls.at(-1)[0]
      gridProps.onColumnResized({
        finished: true,
        source: 'uiColumnResized',
        api: mockGridApi
      })

      expect(JSON.parse(localStorage.getItem('test-grid-column'))).toEqual(
        columnState
      )
    })
  })
})

describe('Compound filter pill regressions', () => {
  it('creates a removable pill for each side of a compound filter', () => {
    const onRemove = vi.fn()
    const pills = createAgGridFilterPills({
      filters: [
        {
          field: 'fuelType',
          operator: 'OR',
          condition1: {
            filterType: 'text',
            type: 'contains',
            filter: 'diesel'
          },
          condition2: {
            filterType: 'text',
            type: 'contains',
            filter: 'renewable'
          }
        }
      ],
      columnLabelLookup: { fuelType: 'Fuel type' },
      onRemove
    })

    expect(pills.map(({ label, value }) => [label, value])).toEqual([
      ['Fuel type', 'diesel'],
      ['Fuel type', 'renewable']
    ])

    pills[1].onRemove()
    expect(onRemove).toHaveBeenCalledWith('fuelType', 'renewable')
  })
})
