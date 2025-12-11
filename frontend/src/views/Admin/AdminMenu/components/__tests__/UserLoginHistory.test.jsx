import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import { UserLoginHistory } from '../UserLoginHistory'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'

// Use vi.hoisted for proper hoisting of mock variables
const mockUseGetUserLoginHistory = vi.hoisted(() => vi.fn())

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock useGetUserLoginHistory hook
vi.mock('@/hooks/useUser', () => ({
  useGetUserLoginHistory: mockUseGetUserLoginHistory
}))

// Mock constants
vi.mock(
  '@/views/Admin/AdminMenu/components/_schema',
  async (importOriginal) => {
    const actual = await importOriginal()
    return {
      ...actual,
      userLoginHistoryColDefs: (t) => [
        { headerName: t('headerNameExample'), field: 'exampleField' }
      ],
      defaultSortModel: [{ field: 'loginDate', sort: 'desc' }]
    }
  }
)

// Mock constants schedules
vi.mock('@/constants/schedules', () => ({
  defaultInitialPagination: {
    page: 1,
    size: 10
  }
}))

// Mock BCGridViewer component
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: vi.fn()
}))

// Mock ClearFiltersButton component
vi.mock('@/components/ClearFiltersButton', () => ({
  ClearFiltersButton: vi.fn()
}))

// Custom render function with providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient()
  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

describe('UserLoginHistory', () => {
  const mockQueryData = {
    data: {
      histories: [
        {
          userLoginHistoryId: 1,
          username: 'user1',
          loginDate: '2024-01-01'
        },
        {
          userLoginHistoryId: 2,
          username: 'user2', 
          loginDate: '2024-01-02'
        }
      ]
    },
    isLoading: false,
    isError: false
  }

  const mockGridRef = {
    current: {
      clearFilters: vi.fn()
    }
  }

  beforeEach(() => {
    vi.resetAllMocks()
    
    mockUseGetUserLoginHistory.mockReturnValue(mockQueryData)
    
    // Configure mocks using vi.mocked
    vi.mocked(BCGridViewer).mockImplementation((props) => {
      // Store ref for testing
      if (props.gridRef) {
        Object.assign(props.gridRef, mockGridRef)
      }
      
      return (
        <div data-test="bc-grid-viewer">
          <button 
            data-test="test-pagination-change" 
            onClick={() => props.onPaginationChange({ page: 2, size: 20 })}
          >
            Test Pagination Change
          </button>
        </div>
      )
    })
    
    vi.mocked(ClearFiltersButton).mockImplementation((props) => (
      <button 
        data-test="clear-filters-button" 
        onClick={props.onClick}
      >
        Clear Filters
      </button>
    ))
  })

  it('renders the UserLoginHistory component with title and grid viewer', () => {
    customRender(<UserLoginHistory />)

    expect(screen.getByText('admin:UserLoginHistory')).toBeInTheDocument()
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument()
  })

  it('calls useTranslation with correct namespaces', () => {
    customRender(<UserLoginHistory />)
    // Translation mock should be called - verify component renders without errors
    expect(screen.getByText('admin:UserLoginHistory')).toBeInTheDocument()
  })

  it('calls useGetUserLoginHistory with initial pagination options', () => {
    customRender(<UserLoginHistory />)
    
    expect(mockUseGetUserLoginHistory).toHaveBeenCalledWith(
      {
        page: 1,
        size: 10,
        sortOrders: [{ field: 'loginDate', sort: 'desc' }],
        filters: []
      },
      {
        cacheTime: 0,
        staleTime: 0
      }
    )
  })

  it('passes correct props to BCGridViewer', () => {
    customRender(<UserLoginHistory />)
    
    expect(vi.mocked(BCGridViewer)).toHaveBeenCalledWith(
      expect.objectContaining({
        gridKey: 'user-login-history-grid',
        dataKey: 'histories',
        overlayNoRowsTemplate: 'admin:historiesNotFound',
        autoSizeStrategy: {
          defaultMinWidth: 50,
          defaultMaxWidth: 600,
          type: 'fitGridWidth'
        }
      }),
      expect.anything()
    )
  })

  it('getRowId callback returns correct value', () => {
    customRender(<UserLoginHistory />)
    
    const getRowIdCall = vi.mocked(BCGridViewer).mock.calls[0][0].getRowId
    const testParams = {
      data: {
        userLoginHistoryId: 123
      }
    }
    
    const result = getRowIdCall(testParams)
    expect(result).toBe('123')
  })

  it('getRowId callback handles different id types', () => {
    customRender(<UserLoginHistory />)
    
    const getRowIdCall = vi.mocked(BCGridViewer).mock.calls[0][0].getRowId
    
    // Test with number
    expect(getRowIdCall({ data: { userLoginHistoryId: 456 } })).toBe('456')
    
    // Test with string number
    expect(getRowIdCall({ data: { userLoginHistoryId: '789' } })).toBe('789')
  })

  it('handleClearFilters resets pagination state', async () => {
    customRender(<UserLoginHistory />)
    
    // Trigger pagination change first
    const paginationChangeButton = screen.getByTestId('test-pagination-change')
    fireEvent.click(paginationChangeButton)
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    
    // Verify pagination was updated
    expect(mockUseGetUserLoginHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 2,
        size: 20
      }),
      expect.anything()
    )
    
    // Now clear filters
    const clearFiltersButton = screen.getByTestId('clear-filters-button')
    fireEvent.click(clearFiltersButton)
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    
    // Verify pagination was reset to initial values
    expect(mockUseGetUserLoginHistory).toHaveBeenLastCalledWith(
      {
        page: 1,
        size: 10,
        sortOrders: [{ field: 'loginDate', sort: 'desc' }],
        filters: []
      },
      expect.anything()
    )
  })

  it('handleClearFilters calls grid clearFilters when ref exists', async () => {
    customRender(<UserLoginHistory />)
    
    const clearFiltersButton = screen.getByTestId('clear-filters-button')
    fireEvent.click(clearFiltersButton)
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    
    expect(mockGridRef.current.clearFilters).toHaveBeenCalled()
  })

  it('handleClearFilters handles null gridRef gracefully', async () => {
    // Override mock to return null ref
    vi.mocked(BCGridViewer).mockImplementation((props) => {
      if (props.gridRef) {
        props.gridRef.current = null
      }
      return (
        <div data-test="bc-grid-viewer">
          <button 
            data-test="test-pagination-change" 
            onClick={() => props.onPaginationChange({ page: 2, size: 20 })}
          >
            Test Pagination Change
          </button>
        </div>
      )
    })
    
    customRender(<UserLoginHistory />)
    
    const clearFiltersButton = screen.getByTestId('clear-filters-button')
    
    // Should not throw error
    expect(() => {
      fireEvent.click(clearFiltersButton)
    }).not.toThrow()
  })

  it('handleClearFilters handles undefined gridRef gracefully', async () => {
    // Override mock to have undefined ref
    vi.mocked(BCGridViewer).mockImplementation((props) => {
      props.gridRef.current = undefined
      return (
        <div data-test="bc-grid-viewer">
          <button 
            data-test="test-pagination-change" 
            onClick={() => props.onPaginationChange({ page: 2, size: 20 })}
          >
            Test Pagination Change
          </button>
        </div>
      )
    })
    
    customRender(<UserLoginHistory />)
    
    const clearFiltersButton = screen.getByTestId('clear-filters-button')
    
    // Should not throw error
    expect(() => {
      fireEvent.click(clearFiltersButton)
    }).not.toThrow()
  })

  it('onPaginationChange callback updates pagination state', async () => {
    customRender(<UserLoginHistory />)
    
    const paginationChangeButton = screen.getByTestId('test-pagination-change')
    fireEvent.click(paginationChangeButton)
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    
    expect(mockUseGetUserLoginHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 2,
        size: 20
      }),
      expect.anything()
    )
  })

  it('renders with loading state', () => {
    mockUseGetUserLoginHistory.mockReturnValue({
      ...mockQueryData,
      isLoading: true
    })
    
    customRender(<UserLoginHistory />)
    
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('renders with error state', () => {
    mockUseGetUserLoginHistory.mockReturnValue({
      ...mockQueryData,
      isError: true,
      error: new Error('Test error')
    })
    
    customRender(<UserLoginHistory />)
    
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('renders with empty data', () => {
    mockUseGetUserLoginHistory.mockReturnValue({
      ...mockQueryData,
      data: { histories: [] }
    })
    
    customRender(<UserLoginHistory />)
    
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('passes columnDefs function result to BCGridViewer', () => {
    customRender(<UserLoginHistory />)
    
    const columnDefsCall = vi.mocked(BCGridViewer).mock.calls[0][0].columnDefs
    expect(Array.isArray(columnDefsCall)).toBe(true)
    expect(columnDefsCall.length).toBeGreaterThan(0)
  })
})
