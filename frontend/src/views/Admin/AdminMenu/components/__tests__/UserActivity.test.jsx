import React from 'react'
import { screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi, describe, expect, beforeEach, afterEach } from 'vitest'
import { UserActivity } from '../UserActivity'
import { test } from '@/tests/utils/fixtures'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

const mockUseNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockUseNavigate
  }
})

vi.mock(
  '@/views/Admin/AdminMenu/components/_schema',
  async (importOriginal) => {
    const actual = await importOriginal()
    return {
      ...actual,
      userActivityColDefs: [
        { headerName: 'Column 1', field: 'col1' },
        { headerName: 'Column 2', field: 'col2' }
      ]
    }
  }
)

// -- Mock BCGridViewer so we can inspect its props --
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: vi.fn(() => <div data-test="bc-grid-viewer">BCGridViewer</div>)
}))

const mockUseGetUserActivities = vi.fn()
vi.mock('@/hooks/useUser', () => ({
  useGetUserActivities: (...args) => mockUseGetUserActivities(...args)
}))

describe('UserActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock return values
    mockUseGetUserActivities.mockReturnValue({
      data: { activities: [] },
      isLoading: false,
      isError: false
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders the heading and the grid', ({ render }) => {
    render(<UserActivity />)

    // 1. Heading check
    expect(screen.getByText('admin:UserActivity')).toBeInTheDocument()

    // 2. BCGridViewer check
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  test('passes the correct props to BCGridViewer', ({ render }) => {
    render(<UserActivity />)

    // BCGridViewer has been mocked, so we can inspect its calls
    expect(BCGridViewer).toHaveBeenCalledTimes(1)
    const gridProps = BCGridViewer.mock.calls[0][0]

    // 1) gridKey
    expect(gridProps.gridKey).toBe('all-user-activities-grid')

    // 2) columnDefs
    expect(gridProps.columnDefs).toEqual([
      { headerName: 'Column 1', field: 'col1' },
      { headerName: 'Column 2', field: 'col2' }
    ])

    // 3) dataKey
    expect(gridProps.dataKey).toBe('activities')

    // 4) getRowId
    expect(gridProps.getRowId).toBeDefined()
    // Optionally check the logic of getRowId
    // This is a unit-style check; you can do something like:
    const mockParams = {
      data: {
        transactionType: 'AdminAdjustment',
        transactionId: '123',
        actionTaken: 'CREATE'
      }
    }
    expect(gridProps.getRowId(mockParams)).toBe('CREATE-AdminAdjustment-123')

    // 5) defaultColDef
    expect(gridProps.defaultColDef).toBeDefined()
    expect(typeof gridProps.defaultColDef.cellRendererParams.url).toBe(
      'function'
    )
  })

  test('generates correct URLs for each transaction type', ({ render }) => {
    render(<UserActivity />)

    // Extract the defaultColDef from BCGridViewer props
    const gridProps = BCGridViewer.mock.calls[0][0]
    const { url } = gridProps.defaultColDef.cellRendererParams

    // Test different transaction types
    const mockData = (transactionType, transactionId) => ({
      data: { transactionType, transactionId }
    })

    // Transfer
    expect(url(mockData('Transfer', 'ABC123'))).toBe('/transfers/ABC123')

    // AdminAdjustment
    expect(url(mockData('AdminAdjustment', 'XYZ789'))).toBe(
      '/admin-adjustment/XYZ789'
    )

    // InitiativeAgreement
    expect(url(mockData('InitiativeAgreement', 'IA555'))).toBe(
      '/initiative-agreement/IA555'
    )
  })

  // If you want to verify that no rows found message is shown if data is empty
  test('shows the overlayNoRowsTemplate when there are no activities', ({
    render
  }) => {
    render(<UserActivity />)

    // BCGridViewer props
    const gridProps = BCGridViewer.mock.calls[0][0]
    // Because data is mocked to []
    expect(gridProps.overlayNoRowsTemplate).toBe('admin:activitiesNotFound')
  })

  test('handles URL generation for undefined transaction type', ({
    render
  }) => {
    render(<UserActivity />)

    // Extract the defaultColDef from BCGridViewer props
    const gridProps = BCGridViewer.mock.calls[0][0]
    const { url } = gridProps.defaultColDef.cellRendererParams

    // Test undefined transaction type
    const mockData = {
      data: { transactionType: undefined, transactionId: 'TEST123' }
    }

    // Should return undefined for unknown transaction types
    expect(url(mockData)).toBeUndefined()

    // Test unknown transaction type
    const mockDataUnknown = {
      data: { transactionType: 'UnknownType', transactionId: 'TEST123' }
    }
    expect(url(mockDataUnknown)).toBeUndefined()
  })

  test('calls useGetUserActivities with correct initial pagination options', ({
    render
  }) => {
    render(<UserActivity />)

    // Verify hook is called with initial pagination options
    expect(mockUseGetUserActivities).toHaveBeenCalledWith(
      {
        page: 1,
        size: 10,
        sortOrders: expect.any(Array), // defaultSortModel from _schema
        filters: []
      },
      {
        cacheTime: 0,
        staleTime: 0
      }
    )
  })

  test('has onPaginationChange callback defined', ({ render }) => {
    render(<UserActivity />)

    // Get the onPaginationChange callback from BCGridViewer props
    const gridProps = BCGridViewer.mock.calls[0][0]
    const { onPaginationChange } = gridProps

    // Verify callback exists and is a function
    expect(onPaginationChange).toBeDefined()
    expect(typeof onPaginationChange).toBe('function')
  })

  test('has onClearFilters callback defined in BCGridViewer', ({ render }) => {
    render(<UserActivity />)

    // Get the onClearFilters callback from BCGridViewer props
    const gridProps = BCGridViewer.mock.calls[0][0]
    const { onClearFilters } = gridProps

    // Verify callback exists and is a function
    expect(onClearFilters).toBeDefined()
    expect(typeof onClearFilters).toBe('function')
  })

  test('tests onPaginationChange callback functionality', ({ render }) => {
    render(<UserActivity />)

    // Get the onPaginationChange callback from BCGridViewer props
    const gridProps = BCGridViewer.mock.calls[0][0]
    const { onPaginationChange } = gridProps

    // Test the callback with new pagination data
    const newPagination = {
      page: 2,
      size: 20,
      sortOrders: [{ field: 'actionTaken', direction: 'desc' }],
      filters: [{ field: 'transactionType', value: 'Transfer' }]
    }

    // Call the onPaginationChange function to test lines 99-102
    act(() => {
      onPaginationChange(newPagination)
    })

    // Verify the hook was called again with updated pagination
    // The component should re-render and call useGetUserActivities again
    expect(mockUseGetUserActivities).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        size: 20,
        sortOrders: [{ field: 'actionTaken', direction: 'desc' }],
        filters: [{ field: 'transactionType', value: 'Transfer' }]
      }),
      {
        cacheTime: 0,
        staleTime: 0
      }
    )
  })

  test('renders BCBox components with correct props', ({ render }) => {
    render(<UserActivity />)

    // Verify main container is rendered
    const container = screen.getByTestId('bc-grid-viewer').closest('div')
    expect(container).toBeInTheDocument()

    // Verify typography heading is rendered
    expect(screen.getByText('admin:UserActivity')).toBeInTheDocument()
  })
})
