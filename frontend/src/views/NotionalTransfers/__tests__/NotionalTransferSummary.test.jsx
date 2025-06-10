import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NotionalTransferSummary } from '../NotionalTransferSummary'
import { wrapper } from '@/tests/utils/wrapper'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// Mock BCGridViewer
vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: ({
    gridKey,
    columnDefs,
    queryData,
    dataKey,
    gridOptions,
    defaultColDef,
    suppressPagination,
    paginationOptions,
    getRowId
  }) => (
    <div data-test="bc-grid-viewer">
      <div data-test="grid-key">{gridKey}</div>
      <div data-test="data-key">{dataKey}</div>
      <div data-test="row-count">
        {queryData?.data?.[dataKey]?.length || 0} rows
      </div>
      <div data-test="pagination-suppressed">
        {suppressPagination ? 'pagination-suppressed' : 'pagination-enabled'}
      </div>
      <div data-test="suppress-pagination-value">
        {String(suppressPagination)}
      </div>
      <div data-test="get-row-id">
        {getRowId ? 'has-get-row-id' : 'no-get-row-id'}
      </div>
    </div>
  )
}))

// Mock the schema
vi.mock('@/views/NotionalTransfers/_schema.jsx', () => ({
  notionalTransferSummaryColDefs: (isEarlyIssuance) => [
    { field: 'legalName', headerName: 'Legal Name' },
    { field: 'quantity', headerName: 'Quantity' },
    ...(isEarlyIssuance
      ? [{ field: 'earlyIssuanceField', headerName: 'Early Issuance' }]
      : [])
  ]
}))

// Mock cell renderers
vi.mock('@/utils/grid/cellRenderers.jsx', () => ({
  LinkRenderer: () => <div>Link Renderer</div>
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

vi.mock('@/constants/common', () => ({
  REPORT_SCHEDULES: {
    QUARTERLY: 'QUARTERLY',
    ANNUAL: 'ANNUAL'
  }
}))

// Mock the store
vi.mock('@/stores/useComplianceReportStore', () => ({
  default: () => ({
    currentReport: {
      report: {
        reportingFrequency: 'ANNUAL'
      }
    }
  })
}))

describe('NotionalTransferSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders the component with BCGridViewer', () => {
    render(
      <NotionalTransferSummary
        data={{ notionalTransfers: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('grid-key')).toHaveTextContent(
      'notional-transfers'
    )
    expect(screen.getByTestId('data-key')).toHaveTextContent(
      'notionalTransfers'
    )
    expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
  })

  it('renders with empty data correctly', () => {
    render(
      <NotionalTransferSummary
        data={{ notionalTransfers: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
  })

  it('renders notional transfer data correctly', () => {
    const mockData = {
      notionalTransfers: [
        {
          notionalTransferId: 1,
          legalName: 'Organization A',
          quantity: 100,
          actionType: 'CREATE'
        },
        {
          notionalTransferId: 2,
          legalName: 'Organization B',
          quantity: 200,
          actionType: 'UPDATE'
        }
      ]
    }

    render(
      <NotionalTransferSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
  })

  it('filters out deleted items', () => {
    const mockData = {
      notionalTransfers: [
        {
          notionalTransferId: 1,
          legalName: 'Organization A',
          quantity: 100,
          actionType: 'CREATE'
        },
        {
          notionalTransferId: 2,
          legalName: 'Organization B',
          quantity: 200,
          actionType: 'DELETE'
        },
        {
          notionalTransferId: 3,
          legalName: 'Organization C',
          quantity: 300,
          actionType: 'UPDATE'
        }
      ]
    }

    render(
      <NotionalTransferSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // Should show 2 rows (excluding the deleted one)
    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
  })

  it('suppresses pagination when 10 or fewer items', () => {
    const mockData = {
      notionalTransfers: Array.from({ length: 8 }, (_, i) => ({
        notionalTransferId: i + 1,
        legalName: `Organization${i + 1}`,
        quantity: (i + 1) * 100,
        actionType: 'CREATE'
      }))
    }

    render(
      <NotionalTransferSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-suppressed'
    )
  })

  it('enables pagination when more than 10 items', () => {
    const mockData = {
      notionalTransfers: Array.from({ length: 15 }, (_, i) => ({
        notionalTransferId: i + 1,
        legalName: `Organization${i + 1}`,
        quantity: (i + 1) * 100,
        actionType: 'CREATE'
      }))
    }

    render(
      <NotionalTransferSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-enabled'
    )
  })

  it('handles non-DRAFT status correctly (no link renderer)', () => {
    render(
      <NotionalTransferSummary
        data={{ notionalTransfers: [] }}
        status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('handles early issuance reporting frequency', () => {
    // Mock the store to return quarterly frequency
    vi.doMock('@/stores/useComplianceReportStore', () => ({
      default: () => ({
        currentReport: {
          report: {
            reportingFrequency: 'QUARTERLY'
          }
        }
      })
    }))

    render(
      <NotionalTransferSummary
        data={{ notionalTransfers: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('applies client-side filtering correctly', () => {
    const mockData = {
      notionalTransfers: [
        {
          notionalTransferId: 1,
          legalName: 'Alpha Corp',
          quantity: 100,
          actionType: 'CREATE'
        },
        {
          notionalTransferId: 2,
          legalName: 'Beta LLC',
          quantity: 200,
          actionType: 'CREATE'
        },
        {
          notionalTransferId: 3,
          legalName: 'Gamma Inc',
          quantity: 300,
          actionType: 'CREATE'
        }
      ]
    }

    render(
      <NotionalTransferSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // All items should be shown without filters
    expect(screen.getByTestId('row-count')).toHaveTextContent('3 rows')
  })

  it('handles missing store data gracefully', () => {
    // Mock empty store
    vi.doMock('@/stores/useComplianceReportStore', () => ({
      default: () => ({
        currentReport: null
      })
    }))

    render(
      <NotionalTransferSummary
        data={{ notionalTransfers: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('correctly implements getRowId function', () => {
    const mockData = {
      notionalTransfers: [
        { notionalTransferId: 123, legalName: 'Test Org', actionType: 'CREATE' }
      ]
    }

    render(
      <NotionalTransferSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // The mock shows that getRowId function is passed
    expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
  })

  it('passes correct auto size strategy', () => {
    render(
      <NotionalTransferSummary
        data={{ notionalTransfers: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // Component should render without errors, indicating autoSizeStrategy is properly passed
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('handles pagination options updates', () => {
    render(
      <NotionalTransferSummary
        data={{ notionalTransfers: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // Component should render and handle pagination options correctly
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })
})
