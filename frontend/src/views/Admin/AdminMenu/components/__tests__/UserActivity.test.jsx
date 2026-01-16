import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { UserActivity } from '../UserActivity'
import { wrapper } from '@/tests/utils/wrapper'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'

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

  it('renders the heading and the grid', () => {
    render(<UserActivity />, { wrapper })

    // 1. Heading check
    expect(screen.getByText('admin:UserActivity')).toBeInTheDocument()

    // 2. BCGridViewer check
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('passes the correct props to BCGridViewer', () => {
    render(<UserActivity />, { wrapper })

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

  it('generates correct URLs for each transaction type', () => {
    render(<UserActivity />, { wrapper })

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
  it('shows the overlayNoRowsTemplate when there are no activities', () => {
    render(<UserActivity />, { wrapper })

    // BCGridViewer props
    const gridProps = BCGridViewer.mock.calls[0][0]
    // Because data is mocked to []
    expect(gridProps.overlayNoRowsTemplate).toBe('admin:activitiesNotFound')
  })

  it('handles URL generation for undefined transaction type', () => {
    render(<UserActivity />, { wrapper })

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

  it('calls useGetUserActivities with correct initial pagination options', () => {
    render(<UserActivity />, { wrapper })

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

  it('has onPaginationChange callback defined', () => {
    render(<UserActivity />, { wrapper })

    // Get the onPaginationChange callback from BCGridViewer props
    const gridProps = BCGridViewer.mock.calls[0][0]
    const { onPaginationChange } = gridProps

    // Verify callback exists and is a function
    expect(onPaginationChange).toBeDefined()
    expect(typeof onPaginationChange).toBe('function')
  })

  it('has onClearFilters callback defined in BCGridViewer', () => {
    render(<UserActivity />, { wrapper })

    // Get the onClearFilters callback from BCGridViewer props
    const gridProps = BCGridViewer.mock.calls[0][0]
    const { onClearFilters } = gridProps

    // Verify callback exists and is a function
    expect(onClearFilters).toBeDefined()
    expect(typeof onClearFilters).toBe('function')
  })

  it('tests onPaginationChange callback functionality', () => {
    render(<UserActivity />, { wrapper })

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

  it('renders BCBox components with correct props', () => {
    render(<UserActivity />, { wrapper })

    // Verify main container is rendered
    const container = screen.getByTestId('bc-grid-viewer').closest('div')
    expect(container).toBeInTheDocument()

    // Verify typography heading is rendered
    expect(screen.getByText('admin:UserActivity')).toBeInTheDocument()
  })
})
