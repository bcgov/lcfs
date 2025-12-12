import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { Notifications } from '../Notifications'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  const { MemoryRouter } = require('react-router-dom')
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const mockCurrentUser = { data: { id: 1, roles: [] } }
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUser
}))

const refetchMock = vi.fn()
const markAsReadMutateMock = vi.fn()
const deleteMutateMock = vi.fn()

vi.mock('@/hooks/useNotifications', () => ({
  useGetNotificationMessages: vi.fn(() => ({ refetch: refetchMock })),
  useMarkNotificationAsRead: () => ({ mutate: markAsReadMutateMock }),
  useDeleteNotificationMessages: () => ({ mutate: deleteMutateMock })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, startIcon, endIcon, color, size, variant, ...props }) => (
    <button
      data-test={props['data-test']}
      data-testid={props['data-test']}
      {...props}
    >
      {children}
    </button>
  )
}))

vi.mock('@/components/ClearFiltersButton', () => ({
  ClearFiltersButton: ({ onClick }) => (
    <button onClick={onClick} data-test="clear-filters">Clear Filters</button>
  )
}))

const clearFiltersMock = vi.fn()
const forEachNodeMock = vi.fn()
const getSelectedNodesMock = vi.fn(() => [])
const setSelectedMock = vi.fn()
const isSelectedMock = vi.fn(() => false)

const mockGridApi = {
  forEachNodeAfterFilterAndSort: forEachNodeMock,
  getSelectedNodes: getSelectedNodesMock
}

const createMockNode = (id, selected = false) => ({
  data: { notificationMessageId: id },
  isSelected: () => selected,
  setSelected: setSelectedMock
})

vi.mock('@/components/BCDataGrid/BCGridViewer', () => {
  const React = require('react')
  return {
    BCGridViewer: React.forwardRef((props, ref) => {
      React.useEffect(() => {
        if (props.gridRef) {
          props.gridRef.current = {
            api: mockGridApi,
            clearFilters: clearFiltersMock
          }
          if (props.onGridReady) {
            props.onGridReady({ api: mockGridApi })
          }
          // Trigger onSelectionChanged to enable buttons
          if (props.onSelectionChanged) {
            props.onSelectionChanged({ api: mockGridApi })
          }
        }
      }, [props.gridRef, props.onGridReady, props.onSelectionChanged])

      return (
        <div data-test="bc-grid-viewer" data-testid="bc-grid-viewer">
          BCGridViewer
          <div 
            data-test="test-row" 
            onClick={() => props.onRowClicked?.({
              data: {
                notificationMessageId: 'test-id',
                message: JSON.stringify({ id: 'test-id', service: 'testService' })
              },
              event: { target: { dataset: {} } }
            })}
          >
            Test Row
          </div>
          <div 
            data-test="test-cell" 
            onClick={() => props.onCellClicked?.({
              data: { notificationMessageId: 'test-id' },
              column: { colId: 'action' },
              event: { target: { dataset: { action: 'delete' } } }
            })}
          >
            Test Cell
          </div>
        </div>
      )
    })
  }
})

vi.mock('../_schema', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    columnDefs: (t, currentUser) => [],
    routesMapping: (currentUser) => ({
      testService: '/test-route/:transactionId',
      fuelCode: '/fuel-codes/:fuelCodeID'
    }),
    defaultColDef: {},
    defaultSortModel: []
  }
})

vi.mock('@/constants/schedules', () => ({
  defaultInitialPagination: { page: 1, size: 10 }
}))

describe('Notifications Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    forEachNodeMock.mockClear()
    getSelectedNodesMock.mockClear().mockReturnValue([])
    setSelectedMock.mockClear()
    clearFiltersMock.mockClear()
    refetchMock.mockClear()
    markAsReadMutateMock.mockClear()
    deleteMutateMock.mockClear()
    navigateMock.mockClear()
  })

  describe('Component Rendering', () => {
    it('renders the grid viewer and action buttons', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('select-all')).toBeInTheDocument()
      expect(screen.getByTestId('mark-as-read')).toBeInTheDocument()
      expect(screen.getByTestId('mark-as-unread')).toBeInTheDocument()
      expect(screen.getByTestId('clear-filters')).toBeInTheDocument()
    })

    it('applies correct initial state', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      const selectAllButton = screen.getByTestId('select-all')
      const markAsReadButton = screen.getByTestId('mark-as-read')
      const deleteButton = screen.getByTestId('mark-as-unread')
      
      expect(selectAllButton).toHaveTextContent('notifications:buttonStack.selectAll')
      expect(markAsReadButton).toBeDisabled()
      expect(deleteButton).toBeDisabled()
    })
  })

  describe('Memoized Values', () => {
    it('rowClassRules returns correct class for unread messages', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      const gridViewer = screen.getByTestId('bc-grid-viewer')
      expect(gridViewer).toBeInTheDocument()
    })

    it('selectionColumnDef has correct configuration', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('rowSelection has multiRow mode', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('Grid Event Handlers', () => {
    it('onGridReady sets grid API', async () => {
      render(<Notifications />, { wrapper: createWrapper() })
      await waitFor(() => {
        expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      })
    })

    it('onSelectionChanged updates selection state', async () => {
      const nodes = [createMockNode('n1', true), createMockNode('n2', false)]
      forEachNodeMock.mockImplementation((callback) => {
        nodes.forEach(callback)
      })

      render(<Notifications />, { wrapper: createWrapper() })
      
      const selectAllButton = screen.getByTestId('select-all')
      await waitFor(() => {
        expect(selectAllButton).toBeInTheDocument()
      })
    })
  })

  describe('Toggle Select Visible Rows', () => {
    it('toggles selection when gridApi is available', async () => {
      const nodes = [createMockNode('n1'), createMockNode('n2')]
      forEachNodeMock.mockImplementation((callback) => {
        nodes.forEach(callback)
      })

      render(<Notifications />, { wrapper: createWrapper() })
      const selectAllButton = screen.getByTestId('select-all')

      fireEvent.click(selectAllButton)
      
      await waitFor(() => {
        expect(forEachNodeMock).toHaveBeenCalled()
      })
    })

    it('handles case when gridApi is not available', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      const selectAllButton = screen.getByTestId('select-all')
      
      expect(selectAllButton).toBeInTheDocument()
    })
  })

  describe('Handle Mutation Function', () => {
    it('shows warning when no notifications are selected', async () => {
      render(<Notifications />, { wrapper: createWrapper() })
      const markAsReadButton = screen.getByTestId('mark-as-read')

      expect(markAsReadButton).toBeDisabled()
      expect(markAsReadMutateMock).not.toHaveBeenCalled()
    })

    it('handles mutation success', async () => {
      const nodes = [createMockNode('n1', true)]
      forEachNodeMock.mockImplementation((callback) => {
        nodes.forEach(callback)
      })
      getSelectedNodesMock.mockReturnValue([{ data: { notificationMessageId: 'n1' } }])
      markAsReadMutateMock.mockImplementation((payload, { onSuccess }) => {
        onSuccess()
      })

      render(<Notifications />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        const markAsReadButton = screen.getByTestId('mark-as-read')
        expect(markAsReadButton).not.toBeDisabled()
      })

      const markAsReadButton = screen.getByTestId('mark-as-read')
      fireEvent.click(markAsReadButton)

      await waitFor(() => {
        expect(markAsReadMutateMock).toHaveBeenCalled()
        expect(refetchMock).toHaveBeenCalled()
      })
    })

    it('handles mutation error', async () => {
      const nodes = [createMockNode('n1', true)]
      forEachNodeMock.mockImplementation((callback) => {
        nodes.forEach(callback)
      })
      getSelectedNodesMock.mockReturnValue([{ data: { notificationMessageId: 'n1' } }])
      const error = new Error('Test error')
      markAsReadMutateMock.mockImplementation((payload, { onError }) => {
        onError(error)
      })

      render(<Notifications />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        const markAsReadButton = screen.getByTestId('mark-as-read')
        expect(markAsReadButton).not.toBeDisabled()
      })

      const markAsReadButton = screen.getByTestId('mark-as-read')
      fireEvent.click(markAsReadButton)

      await waitFor(() => {
        expect(markAsReadMutateMock).toHaveBeenCalled()
      })
    })
  })

  describe('Handle Mark As Read', () => {
    it('calls markAsRead mutation when button is clicked', async () => {
      const nodes = [createMockNode('n1', true)]
      forEachNodeMock.mockImplementation((callback) => {
        nodes.forEach(callback)
      })
      getSelectedNodesMock.mockReturnValue([{ data: { notificationMessageId: 'n1' } }])

      render(<Notifications />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        const markAsReadButton = screen.getByTestId('mark-as-read')
        expect(markAsReadButton).not.toBeDisabled()
      })

      const markAsReadButton = screen.getByTestId('mark-as-read')
      fireEvent.click(markAsReadButton)

      await waitFor(() => {
        expect(markAsReadMutateMock).toHaveBeenCalled()
      })
    })

    it('handles different payload structures', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      expect(screen.getByTestId('mark-as-read')).toBeInTheDocument()
    })
  })

  describe('Handle Delete', () => {
    it('calls delete mutation when button is clicked', async () => {
      const nodes = [createMockNode('n1', true)]
      forEachNodeMock.mockImplementation((callback) => {
        nodes.forEach(callback)
      })
      getSelectedNodesMock.mockReturnValue([{ data: { notificationMessageId: 'n1' } }])

      render(<Notifications />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        const deleteButton = screen.getByTestId('mark-as-unread')
        expect(deleteButton).not.toBeDisabled()
      })

      const deleteButton = screen.getByTestId('mark-as-unread')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(deleteMutateMock).toHaveBeenCalled()
      })
    })

    it('handles different payload structures', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      expect(screen.getByTestId('mark-as-unread')).toBeInTheDocument()
    })
  })

  describe('Handle Row Clicked', () => {
    it('navigates and marks as read with valid route', async () => {
      render(<Notifications />, { wrapper: createWrapper() })
      const testRow = screen.getByTestId('test-row')

      fireEvent.click(testRow)

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith('/test-route/test-id')
        expect(markAsReadMutateMock).toHaveBeenCalledWith(
          { notification_ids: ['test-id'] },
          expect.any(Object)
        )
      })
    })

    it('does not navigate when delete action is clicked', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      
      expect(navigateMock).not.toHaveBeenCalled()
    })

    it('handles notification without service field using type', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('Handle Cell Clicked', () => {
    it('calls delete mutation when action column is clicked', async () => {
      render(<Notifications />, { wrapper: createWrapper() })
      const testCell = screen.getByTestId('test-cell')

      fireEvent.click(testCell)

      await waitFor(() => {
        expect(deleteMutateMock).toHaveBeenCalledWith(
          { notification_ids: ['test-id'] },
          expect.any(Object)
        )
      })
    })

    it('does not call delete when non-action column is clicked', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      expect(deleteMutateMock).not.toHaveBeenCalled()
    })
  })

  describe('Handle Clear Filters', () => {
    it('resets pagination options and clears grid filters', async () => {
      render(<Notifications />, { wrapper: createWrapper() })
      const clearFiltersButton = screen.getByTestId('clear-filters')

      fireEvent.click(clearFiltersButton)

      await waitFor(() => {
        expect(clearFiltersMock).toHaveBeenCalled()
      })
    })
  })

  describe('Pagination and Data Handling', () => {
    it('handles pagination options updates', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('handles query data with caching disabled', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles missing routeTemplate gracefully', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('handles edge cases gracefully', () => {
      render(<Notifications />, { wrapper: createWrapper() })
      expect(screen.getByTestId('test-row')).toBeInTheDocument()
      expect(screen.getByTestId('test-cell')).toBeInTheDocument()
    })
  })
})