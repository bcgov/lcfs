import React from 'react'
import { render, screen } from '@testing-library/react'
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

vi.mock('@/hooks/useUser', () => ({
  useGetUserActivities: () => ({
    data: { activities: [] }, // or mock real data if needed
    isLoading: false,
    isError: false
  })
}))

describe('UserActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
