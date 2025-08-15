import { render, screen, waitFor, act } from '@testing-library/react'
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest'
import BCDataGridServer from '../BCDataGridServer'

// Setup mocks
const mockApiService = vi.fn()
const mockTranslation = vi.fn((key) => key)
const mockGridRef = { current: { api: { setFilterModel: vi.fn(), applyColumnState: vi.fn(), getFilterModel: vi.fn(), getColumnState: vi.fn(), hideOverlay: vi.fn() } } }

// Mock external dependencies
vi.mock('@/services/useApiService', () => ({
  useApiService: vi.fn()
}))

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn()
}))

vi.mock('@ag-grid-community/react', () => ({
  AgGridReact: vi.fn()
}))

vi.mock('@/components/BCAlert', () => ({
  default: vi.fn()
}))

vi.mock('@/components/BCBox', () => ({
  default: vi.fn()
}))

vi.mock('@/components/DataGridLoading', () => ({
  default: vi.fn()
}))

vi.mock('../components', () => ({
  AccessibleHeader: vi.fn(() => 'AccessibleHeader'),
  BCPagination: vi.fn(() => null)
}))

// Mock AG Grid modules registration
vi.mock('@ag-grid-community/core', () => ({
  ModuleRegistry: {
    registerModules: vi.fn()
  }
}))

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage })

// Import modules to get mocked versions
import { useApiService } from '@/services/useApiService'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from '@ag-grid-community/react'
import { AccessibleHeader, BCPagination } from '../components'
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import DataGridLoading from '@/components/DataGridLoading'

beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks()
  
  // Setup default mock implementations
  vi.mocked(useApiService).mockReturnValue(mockApiService)
  vi.mocked(useTranslation).mockReturnValue({ t: mockTranslation })
  
  vi.mocked(AgGridReact).mockImplementation(({ onGridReady, onFirstDataRendered, onSortChanged, onFilterChanged, className }) => {
    // Store callbacks for testing on a global object accessible to tests
    globalThis.agGridCallbacks = { onGridReady, onFirstDataRendered, onSortChanged, onFilterChanged }
    return <div data-testid="ag-grid-react" className={className} />
  })
  
  vi.mocked(BCAlert).mockImplementation(({ children, severity }) => (
    <div data-testid="bc-alert" data-severity={severity}>{children}</div>
  ))
  
  vi.mocked(BCBox).mockImplementation(({ children, className }) => (
    <div data-testid="bc-box" className={className}>{children}</div>
  ))
  
  vi.mocked(DataGridLoading).mockImplementation(() => <div data-testid="data-grid-loading" />)
  
  vi.mocked(BCPagination).mockImplementation(({ page, size, total }) => (
    <div data-testid="bc-pagination" data-page={page} data-size={size} data-total={total} />
  ))
  
  // Setup successful API response by default
  mockApiService.mockResolvedValue({
    data: {
      pagination: { total: 100, page: 1 },
      testData: [{ id: 1, name: 'Test' }]
    }
  })
  
  // Clear sessionStorage mocks
  mockSessionStorage.getItem.mockReturnValue(null)
})

afterEach(() => {
  vi.clearAllMocks()
})

// Default test props
const defaultProps = {
  columnDefs: [{ field: 'name', headerName: 'Name' }],
  apiEndpoint: '/test-api',
  apiData: 'testData',
  gridKey: 'test-grid',
  gridRef: mockGridRef
}

describe('BCDataGridServer', () => {
  test('handles successful API call and updates state', async () => {
    render(<BCDataGridServer {...defaultProps} />)
    
    await waitFor(() => {
      expect(mockApiService).toHaveBeenCalledWith({
        method: 'post',
        url: '/test-api',
        data: {
          page: 1,
          size: 10,
          sortOrders: [],
          filters: []
        }
      })
    })
  })

  test('grid callbacks are properly defined', async () => {
    render(<BCDataGridServer {...defaultProps} />)
    
    await waitFor(() => {
      expect(globalThis.agGridCallbacks).toBeDefined()
      expect(globalThis.agGridCallbacks.onGridReady).toBeTypeOf('function')
      expect(globalThis.agGridCallbacks.onSortChanged).toBeTypeOf('function')
      expect(globalThis.agGridCallbacks.onFilterChanged).toBeTypeOf('function')
      expect(globalThis.agGridCallbacks.onFirstDataRendered).toBeTypeOf('function')
    })
  })

  test('onFirstDataRendered hides loading overlay', async () => {
    render(<BCDataGridServer {...defaultProps} />)
    
    await waitFor(() => {
      const { onFirstDataRendered } = globalThis.agGridCallbacks
      const mockParams = { api: { hideOverlay: vi.fn() } }
      
      act(() => {
        onFirstDataRendered(mockParams)
      })
      
      expect(mockParams.api.hideOverlay).toHaveBeenCalled()
    })
  })

  test('pagination handlers update state correctly', async () => {
    render(<BCDataGridServer {...defaultProps} />)
    
    await waitFor(() => {
      expect(vi.mocked(BCPagination)).toHaveBeenCalled()
      const paginationProps = vi.mocked(BCPagination).mock.calls[0][0]
      
      // Test page change
      act(() => {
        paginationProps.handleChangePage({}, 2)
      })
    })
    
    await waitFor(() => {
      expect(mockApiService).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ page: 3 })
        })
      )
    })
  })

  test('rows per page handler resets to page 1', async () => {
    render(<BCDataGridServer {...defaultProps} />)
    
    await waitFor(() => {
      const paginationProps = vi.mocked(BCPagination).mock.calls[0][0]
      
      act(() => {
        paginationProps.handleChangeRowsPerPage({ target: { value: '25' } })
      })
    })
    
    await waitFor(() => {
      expect(mockApiService).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ page: 1, size: 25 })
        })
      )
    })
  })

  test('suppressPagination prop controls pagination rendering', async () => {
    const { rerender } = render(<BCDataGridServer {...defaultProps} suppressPagination={true} />)
    
    await waitFor(() => {
      expect(vi.mocked(BCPagination)).not.toHaveBeenCalled()
    })
    
    rerender(<BCDataGridServer {...defaultProps} suppressPagination={false} />)
    
    await waitFor(() => {
      expect(vi.mocked(BCPagination)).toHaveBeenCalled()
    })
  })

  test('component props are passed correctly to child components', async () => {
    render(<BCDataGridServer {...defaultProps} />)
    
    await waitFor(() => {
      expect(vi.mocked(AgGridReact)).toHaveBeenCalledWith(
        expect.objectContaining({
          columnDefs: defaultProps.columnDefs,
          gridKey: defaultProps.gridKey
        }),
        expect.anything()
      )
      
      expect(vi.mocked(BCPagination)).toHaveBeenCalledWith(
        expect.objectContaining({
          page: expect.any(Number),
          size: expect.any(Number),
          total: expect.any(Number)
        }),
        expect.anything()
      )
    })
  })

  test('memoized components are properly configured', async () => {
    render(<BCDataGridServer {...defaultProps} />)
    
    await waitFor(() => {
      // Verify AgGridReact is called with memoized props
      const agGridCall = vi.mocked(AgGridReact).mock.calls[0][0]
      expect(agGridCall.defaultColDef).toBeDefined()
      expect(agGridCall.gridOptions).toBeDefined()
      expect(agGridCall.loadingOverlayComponent).toBeDefined()
    })
  })
})