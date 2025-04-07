import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const createWrapper = () => {
  const queryClient = new QueryClient()
  const { MemoryRouter } = require('react-router-dom')
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: {} })
}))

const refetchMock = vi.fn()
const markAsReadMutateMock = vi.fn()
const deleteMutateMock = vi.fn()

vi.mock('@/hooks/useNotifications', () => ({
  useGetNotificationMessages: () => ({ refetch: refetchMock }),
  useMarkNotificationAsRead: () => ({ mutate: markAsReadMutateMock }),
  useDeleteNotificationMessages: () => ({ mutate: deleteMutateMock })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, ...props }) => (
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
    <button onClick={onClick}>Clear Filters</button>
  )
}))

const clearFiltersMock = vi.fn()
vi.mock('@/components/BCDataGrid/BCGridViewer', () => {
  const React = require('react')
  return {
    BCGridViewer: (props) => {
      React.useEffect(() => {
        if (props.gridRef) {
          props.gridRef.current = {
            api: {
              forEachNodeAfterFilterAndSort: (callback) => {
                const nodes = [
                  {
                    data: { notificationMessageId: 'n1' },
                    isSelected: () => true,
                    setSelected: () => {}
                  },
                  {
                    data: { notificationMessageId: 'n2' },
                    isSelected: () => false,
                    setSelected: () => {}
                  }
                ]
                nodes.forEach(callback)
              },
              getSelectedNodes: () => [
                { data: { notificationMessageId: 'n1' } }
              ]
            },
            clearFilters: clearFiltersMock
          }
          if (props.onSelectionChanged) {
            props.onSelectionChanged({
              api: props.gridRef.current.api
            })
          }
          if (props.onGridReady) {
            props.onGridReady({ api: props.gridRef.current.api })
          }
        }
      }, [
        props.gridRef,
        props.onSelectionChanged,
        props.onSetResetGrid,
        props.onGridReady
      ])

      return (
        <div data-test="bc-grid-viewer" data-testid="bc-grid-viewer">
          BCGridViewer
        </div>
      )
    }
  }
})

vi.mock('../_schema', () => ({
  columnDefs: (t, currentUser) => [],
  routesMapping: (currentUser) => ({
    testService: '/test-route/:transactionId'
  })
}))

import { Notifications } from '../Notifications'

describe('Notifications Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the grid viewer and action buttons', () => {
    render(<Notifications />, { wrapper: createWrapper() })
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('select-all')).toBeInTheDocument()
    expect(screen.getByTestId('mark-as-read')).toBeInTheDocument()
    expect(screen.getByTestId('mark-as-unread')).toBeInTheDocument()
    expect(screen.getByText('Clear Filters')).toBeInTheDocument()
  })

  it('toggles select-all button text when clicked', async () => {
    render(<Notifications />, { wrapper: createWrapper() })
    const selectAllButton = screen.getByTestId('select-all')
    expect(selectAllButton).toHaveTextContent(
      'notifications:buttonStack.selectAll'
    )
    fireEvent.click(selectAllButton)
    await waitFor(() => {
      expect(selectAllButton).toHaveTextContent(
        'notifications:buttonStack.unselectAll'
      )
    })
  })

  it('calls markAsRead mutation when "mark-as-read" button is clicked', async () => {
    render(<Notifications />, { wrapper: createWrapper() })
    const markAsReadButton = screen.getByTestId('mark-as-read')
    fireEvent.click(markAsReadButton)
    await waitFor(() => {
      expect(markAsReadMutateMock).toHaveBeenCalledWith(
        { notification_ids: ['n1'] },
        expect.any(Object)
      )
    })
  })

  it('calls delete mutation when "mark-as-unread" button is clicked', async () => {
    render(<Notifications />, { wrapper: createWrapper() })
    const deleteButton = screen.getByTestId('mark-as-unread')
    fireEvent.click(deleteButton)
    await waitFor(() => {
      expect(deleteMutateMock).toHaveBeenCalledWith(
        { notification_ids: ['n1'] },
        expect.any(Object)
      )
    })
  })

  describe('Custom GridViewer Overrides', () => {
    beforeEach(() => {
      vi.resetModules()
    })

    it('calls the resetGrid function when "Clear Filters" is clicked', async () => {
      const { Notifications: NotificationsOverride } = await import(
        '../Notifications'
      )
      render(<NotificationsOverride />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByText('Clear Filters'))

      await waitFor(() => {
        expect(clearFiltersMock).toHaveBeenCalled()
      })
    })

    it('navigates correctly and marks notification as read on row click', async () => {
      vi.doMock('@/components/BCDataGrid/BCGridViewer', () => {
        const React = require('react')
        return {
          BCGridViewer: (props) => (
            <div data-test="bc-grid-viewer" data-testid="bc-grid-viewer">
              <div
                data-test="grid-row"
                data-testid="grid-row"
                onClick={() => {
                  if (props.onRowClicked) {
                    props.onRowClicked({
                      data: {
                        notificationMessageId: 'n1',
                        message: JSON.stringify({
                          id: 'txn1',
                          service: 'testService',
                          compliancePeriod: '2024'
                        })
                      },
                      event: { target: { dataset: {} } }
                    })
                  }
                }}
              >
                Grid Row
              </div>
            </div>
          )
        }
      })
      const { Notifications: NotificationsOverride } = await import(
        '../Notifications'
      )
      render(<NotificationsOverride />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByTestId('grid-row'))

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith('/test-route/txn1')
        expect(markAsReadMutateMock).toHaveBeenCalledWith(
          { notification_ids: ['n1'] },
          expect.any(Object)
        )
      })
    })

    it('calls delete mutation on cell click when data-action="delete"', async () => {
      vi.doMock('@/components/BCDataGrid/BCGridViewer', () => {
        const React = require('react')
        return {
          BCGridViewer: (props) => (
            <div data-test="bc-grid-viewer" data-testid="bc-grid-viewer">
              <div
                data-test="grid-cell-delete"
                data-testid="grid-cell-delete"
                onClick={() => {
                  if (props.onCellClicked) {
                    props.onCellClicked({
                      data: { notificationMessageId: 'n1' },
                      column: { colId: 'action' },
                      event: { target: { dataset: { action: 'delete' } } }
                    })
                  }
                }}
              >
                Delete Icon
              </div>
            </div>
          )
        }
      })
      const { Notifications: NotificationsOverride } = await import(
        '../Notifications'
      )
      render(<NotificationsOverride />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByTestId('grid-cell-delete'))

      await waitFor(() => {
        expect(deleteMutateMock).toHaveBeenCalledWith(
          { notification_ids: ['n1'] },
          expect.any(Object)
        )
      })
    })
  })
})
