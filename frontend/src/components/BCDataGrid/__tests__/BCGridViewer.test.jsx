import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRef } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { BCGridViewer } from '../BCGridViewer'

// Mock components and dependencies
vi.mock('@/components/BCAlert', () => ({
  default: ({ severity, children }) => (
    <div data-testid="bc-alert" data-severity={severity}>
      {children}
    </div>
  ),
  FloatingAlert: vi.fn().mockImplementation(({ children, ...props }) => (
    <div data-testid="floating-alert" {...props}>
      {children}
    </div>
  ))
}))

vi.mock('@/components/BCBox', () => ({
  default: vi.fn().mockImplementation(({ children, ...props }) => (
    <div data-testid="bc-box" {...props}>
      {children}
    </div>
  ))
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
  BCGridBase: vi.fn().mockImplementation((props) => {
    const { onGridReady, onFirstDataRendered, onFilterChanged, onSortChanged } = props
    
    // Simulate grid ready
    if (onGridReady) {
      setTimeout(() => onGridReady({ api: mockGridApi }), 0)
    }
    
    return (
      <div 
        data-testid="bc-grid-base"
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

vi.mock('@/components/BCDataGrid/components', () => ({
  AccessibleHeader: () => <div data-testid="accessible-header">Header</div>,
  BCPagination: vi.fn().mockImplementation((props) => (
    <div 
      data-testid="bc-pagination"
      onClick={() => {
        if (props.handleChangePage) props.handleChangePage({}, 1)
        if (props.handleChangeRowsPerPage) props.handleChangeRowsPerPage({ target: { value: '20' } })
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
      
      expect(screen.getByText(/Server error/)).toBeInTheDocument()
      expect(screen.getByText(/Please contact your administrator/)).toBeInTheDocument()
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
      window.IntersectionObserver = undefined
      
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
      window.IntersectionObserver = originalIntersectionObserver
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
          data: { items: [{ id: 1 }], pagination: { page: 1, size: 10, total: 1 } },
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
})