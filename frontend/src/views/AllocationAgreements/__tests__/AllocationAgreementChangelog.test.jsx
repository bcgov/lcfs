import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AllocationAgreementChangelog } from '../AllocationAgreementChangelog'
import { wrapper } from '@/tests/utils/wrapper'
import {
  useGetChangeLog,
  useComplianceReportWithCache
} from '@/hooks/useComplianceReports'

// Mock hooks
vi.mock('@/hooks/useComplianceReports')

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock BCGridViewer
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: ({
    gridKey,
    columnDefs,
    queryData,
    getRowId,
    suppressPagination,
    gridOptions,
    defaultColDef,
    paginationOptions,
    onPaginationChange
  }) => (
    <div data-test="bc-grid-viewer">
      <div data-test="grid-key">{gridKey}</div>
      <div data-test="row-count">
        {queryData?.data?.items?.length || 0} rows
      </div>
      <div data-test="pagination-suppressed">
        {suppressPagination ? 'pagination-suppressed' : 'pagination-enabled'}
      </div>
      <div data-test="has-pagination-options">
        {paginationOptions ? 'has-pagination' : 'no-pagination'}
      </div>
      <div data-test="has-pagination-change">
        {onPaginationChange ? 'has-change-handler' : 'no-change-handler'}
      </div>
      <div data-test="get-row-id">
        {getRowId ? 'has-get-row-id' : 'no-get-row-id'}
      </div>
      {/* Simulate items for testing */}
      {queryData?.data?.items?.map((item, index) => (
        <div key={index} data-test="grid-item">
          {item.allocationAgreementId} - {item.actionType}
        </div>
      ))}
    </div>
  )
}))

// Mock Loading component
vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading-component">Loading...</div>
}))

// Mock the store
vi.mock('@/stores/useComplianceReportStore', () => ({
  default: () => ({
    currentReport: {
      report: {
        complianceReportGroupUuid: 'test-group-uuid'
      }
    }
  })
}))

// Mock schema
vi.mock('./_schema', () => ({
  changelogColDefs: () => [
    { field: 'agreementName', headerName: 'Agreement Name' },
    { field: 'actionType', headerName: 'Action' }
  ],
  changelogCommonColDefs: (highlight) => [
    { field: 'agreementName', headerName: 'Agreement Name' },
    { field: 'fuel', headerName: 'Fuel' }
  ]
}))

// Mock constants
vi.mock('@/constants/schedules.js', () => ({
  defaultInitialPagination: {
    page: 1,
    size: 10,
    filters: [],
    sortOrders: []
  }
}))

// Mock colors
vi.mock('@/themes/base/colors', () => ({
  default: {
    alerts: {
      error: { background: '#ffebee' },
      success: { background: '#e8f5e8' }
    }
  }
}))

describe('AllocationAgreementChangelog', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Set up default mocks for the hooks
    vi.mocked(useComplianceReportWithCache).mockReturnValue({
      data: {
        report: {
          complianceReportGroupUuid: 'test-group-uuid'
        }
      },
      isLoading: false
    })

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: [],
      isLoading: false
    })
  })

  it('shows loading component when data is loading', () => {
    vi.mocked(useGetChangeLog).mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<AllocationAgreementChangelog />, { wrapper })
    expect(screen.getByTestId('loading-component')).toBeInTheDocument()
  })

  it('renders empty state when no changelog data', () => {
    vi.mocked(useGetChangeLog).mockReturnValue({
      data: [],
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, { wrapper })

    // Should render but with no changelog items
    const grids = screen.queryAllByTestId('bc-grid-viewer')
    expect(grids).toHaveLength(0)
  })

  it('renders single changelog item correctly', () => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Version 1.0',
        allocationAgreements: [
          {
            allocationAgreementId: 1,
            agreementName: 'Agreement A',
            actionType: 'CREATE'
          },
          {
            allocationAgreementId: 2,
            agreementName: 'Agreement B',
            actionType: 'UPDATE'
          }
        ]
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, { wrapper })

    expect(screen.getByText('Version 1.0')).toBeInTheDocument()
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
  })

  it('renders multiple changelog items correctly', () => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Current Version',
        allocationAgreements: [
          {
            allocationAgreementId: 1,
            agreementName: 'Agreement A',
            actionType: 'CREATE'
          }
        ]
      },
      {
        version: 0,
        nickname: 'Original Version',
        allocationAgreements: [
          {
            allocationAgreementId: 2,
            agreementName: 'Agreement B',
            actionType: 'DELETE'
          }
        ]
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, { wrapper })

    expect(screen.getByText('Current Version')).toBeInTheDocument()
    expect(screen.getByText('Original Version')).toBeInTheDocument()

    const grids = screen.getAllByTestId('bc-grid-viewer')
    expect(grids).toHaveLength(2)
  })

  it('suppresses pagination for small datasets', () => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Small Dataset',
        allocationAgreements: Array.from({ length: 5 }, (_, i) => ({
          allocationAgreementId: i + 1,
          agreementName: `Agreement ${i + 1}`,
          actionType: 'CREATE'
        }))
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, { wrapper })

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-suppressed'
    )
    expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
      'no-pagination'
    )
    expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
      'no-change-handler'
    )
  })

  it('enables pagination for large datasets', () => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Large Dataset',
        allocationAgreements: Array.from({ length: 15 }, (_, i) => ({
          allocationAgreementId: i + 1,
          agreementName: `Agreement ${i + 1}`,
          actionType: 'CREATE'
        }))
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, { wrapper })

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-enabled'
    )
    expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
      'has-pagination'
    )
    expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
      'has-change-handler'
    )
  })

  it('uses different column definitions for current/original vs other versions', () => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Current Version',
        allocationAgreements: [
          {
            allocationAgreementId: 1,
            agreementName: 'Agreement A',
            actionType: 'CREATE'
          }
        ]
      },
      {
        version: 2,
        nickname: 'Middle Version',
        allocationAgreements: [
          {
            allocationAgreementId: 2,
            agreementName: 'Agreement B',
            actionType: 'UPDATE'
          }
        ]
      },
      {
        version: 0,
        nickname: 'Original Version',
        allocationAgreements: [
          {
            allocationAgreementId: 3,
            agreementName: 'Agreement C',
            actionType: 'DELETE'
          }
        ]
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, { wrapper })

    const grids = screen.getAllByTestId('bc-grid-viewer')
    expect(grids).toHaveLength(3)

    // All should have getRowId function
    const getRowIdElements = screen.getAllByTestId('get-row-id')
    getRowIdElements.forEach((element) => {
      expect(element).toHaveTextContent('has-get-row-id')
    })
  })

  it('handles empty allocation agreements array', () => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Empty Version',
        allocationAgreements: []
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, { wrapper })

    expect(screen.getByText('Empty Version')).toBeInTheDocument()
    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-suppressed'
    )
  })

  it('handles missing store data gracefully', () => {
    // Mock empty store
    vi.doMock('@/stores/useComplianceReportStore', () => ({
      default: () => ({
        currentReport: null
      })
    }))

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: [],
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, { wrapper })

    // Should render without errors
    const grids = screen.queryAllByTestId('bc-grid-viewer')
    expect(grids).toHaveLength(0)
  })

  it('generates unique grid keys for multiple versions', () => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Version 1',
        allocationAgreements: [
          {
            allocationAgreementId: 1,
            agreementName: 'Agreement A',
            actionType: 'CREATE'
          }
        ]
      },
      {
        version: 2,
        nickname: 'Version 2',
        allocationAgreements: [
          {
            allocationAgreementId: 2,
            agreementName: 'Agreement B',
            actionType: 'UPDATE'
          }
        ]
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, { wrapper })

    const gridKeys = screen.getAllByTestId('grid-key')
    expect(gridKeys[0]).toHaveTextContent('allocation-agreements-changelog-0')
    expect(gridKeys[1]).toHaveTextContent('allocation-agreements-changelog-1')
  })

  it('correctly identifies current and original versions', async () => {
    const mockChangelogData = [
      {
        version: 2, // Current (index 0)
        nickname: 'Current Version',
        allocationAgreements: [
          {
            allocationAgreementId: 1,
            agreementName: 'Agreement A',
            actionType: 'CREATE'
          }
        ]
      },
      {
        version: 1, // Middle version
        nickname: 'Middle Version',
        allocationAgreements: [
          {
            allocationAgreementId: 2,
            agreementName: 'Agreement B',
            actionType: 'UPDATE'
          }
        ]
      },
      {
        version: 0, // Original version
        nickname: 'Original Version',
        allocationAgreements: [
          {
            allocationAgreementId: 3,
            agreementName: 'Agreement C',
            actionType: 'DELETE'
          }
        ]
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, { wrapper })

    await waitFor(() => {
      const grids = screen.getAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(3)
    })
  })

  it('handles pagination state management correctly', () => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Paginated Version',
        allocationAgreements: Array.from({ length: 15 }, (_, i) => ({
          allocationAgreementId: i + 1,
          agreementName: `Agreement ${i + 1}`,
          actionType: 'CREATE'
        }))
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, { wrapper })

    // Should show first 10 items (default page size)
    expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows')
    expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
      'has-change-handler'
    )
  })

  it('handles undefined changelog data', () => {
    vi.mocked(useGetChangeLog).mockReturnValue({
      data: undefined,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, { wrapper })

    // Should render without errors
    const grids = screen.queryAllByTestId('bc-grid-viewer')
    expect(grids).toHaveLength(0)
  })
})
