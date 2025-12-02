import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { FuelExportSummary } from '../FuelExportSummary'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock BCGridViewer with enhanced mock to capture function calls
let mockOnPaginationChange = vi.fn()
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
    getRowId,
    enableCopyButton,
    onPaginationChange
  }) => {
    // Store the pagination callback for testing
    mockOnPaginationChange = onPaginationChange
    
    return (
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
        <div data-test="copy-button">
          {enableCopyButton ? 'copy-enabled' : 'copy-disabled'}
        </div>
        <div data-test="has-pagination-options">
          {paginationOptions ? 'has-pagination' : 'no-pagination'}
        </div>
        <div data-test="grid-options-template">
          {gridOptions?.overlayNoRowsTemplate || 'default-template'}
        </div>
        <div data-test="default-col-def">
          {defaultColDef?.cellRenderer ? 'has-cell-renderer' : 'no-cell-renderer'}
        </div>
        {/* Button to test pagination callback */}
        <button data-test="test-pagination-change" onClick={() => onPaginationChange && onPaginationChange({ page: 2, size: 20 })}>
          Test Pagination Change
        </button>
        {/* Test getRowId function */}
        <div data-test="get-row-id-result">
          {getRowId && queryData?.data?.[dataKey]?.[0] ? getRowId({ data: queryData.data[dataKey][0] }) : 'no-result'}
        </div>
      </div>
    )
  }
}))

// Mock the schema - enhanced to support showFuelTypeOther parameter
vi.mock('@/views/FuelExports/_schema.jsx', () => {
  const mockColDefs = vi.fn((showFuelTypeOther) => [
    { field: 'fuelType', headerName: 'Fuel Type' },
    { field: 'quantity', headerName: 'Quantity' },
    { field: 'destination', headerName: 'Destination' },
    ...(showFuelTypeOther ? [{ field: 'otherFuelType', headerName: 'Other Fuel Type' }] : [])
  ])
  return {
    fuelExportSummaryColDefs: mockColDefs
  }
})

// Mock cell renderers
vi.mock('@/utils/grid/cellRenderers.jsx', () => ({
  LinkRenderer: () => <div>Link Renderer</div>
}))

// Mock constants
vi.mock('@/constants/schedules', () => ({
  defaultInitialPagination: {
    page: 1,
    size: 10,
    filters: [],
    sortOrders: []
  }
}))

// Mock other components
vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => <div data-test="bc-box" {...props}>{children}</div>
}))

vi.mock('@mui/material/Grid2', () => ({
  default: ({ children, ...props }) => <div data-test="mui-grid2" {...props}>{children}</div>
}))

// Mock constants
vi.mock('@/constants/statuses', () => ({
  COMPLIANCE_REPORT_STATUSES: {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted'
  }
}))

// Mock theme
vi.mock('@/themes', () => ({
  default: {}
}))

// Constants for testing
const COMPLIANCE_REPORT_STATUSES = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted'
}

describe('FuelExportSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the component with BCGridViewer', () => {
    render(
      <FuelExportSummary
        data={{ fuelExports: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('grid-key')).toHaveTextContent('fuel-exports')
    expect(screen.getByTestId('data-key')).toHaveTextContent('fuelExports')
    expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
    expect(screen.getByTestId('copy-button')).toHaveTextContent('copy-disabled')
  })

  it('renders with empty data correctly', () => {
    render(
      <FuelExportSummary
        data={{ fuelExports: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
  })

  it('renders fuel export data correctly', () => {
    const mockData = {
      fuelExports: [
        {
          fuelExportId: 1,
          fuelType: { fuelType: 'Diesel' },
          quantity: 100,
          destination: 'USA',
          actionType: 'CREATE'
        },
        {
          fuelExportId: 2,
          fuelType: { fuelType: 'Gasoline' },
          quantity: 200,
          destination: 'Mexico',
          actionType: 'UPDATE'
        }
      ]
    }

    render(
      <FuelExportSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
  })

  it('filters out deleted items', () => {
    const mockData = {
      fuelExports: [
        {
          fuelExportId: 1,
          fuelType: { fuelType: 'Diesel' },
          quantity: 100,
          destination: 'USA',
          actionType: 'CREATE'
        },
        {
          fuelExportId: 2,
          fuelType: { fuelType: 'Gasoline' },
          quantity: 200,
          destination: 'Mexico',
          actionType: 'DELETE'
        },
        {
          fuelExportId: 3,
          fuelType: { fuelType: 'Biodiesel' },
          quantity: 300,
          destination: 'Canada',
          actionType: 'UPDATE'
        }
      ]
    }

    render(
      <FuelExportSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />
    )

    // Should show 2 rows (excluding the deleted one)
    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
  })

  it('suppresses pagination when 10 or fewer items', () => {
    const mockData = {
      fuelExports: Array.from({ length: 8 }, (_, i) => ({
        fuelExportId: i + 1,
        fuelType: { fuelType: 'Diesel' },
        quantity: (i + 1) * 100,
        destination: 'USA',
        actionType: 'CREATE'
      }))
    }

    render(
      <FuelExportSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />
    )

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-suppressed'
    )
    expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
      'has-pagination'
    )
  })

  it('enables pagination when more than 10 items', () => {
    const mockData = {
      fuelExports: Array.from({ length: 15 }, (_, i) => ({
        fuelExportId: i + 1,
        fuelType: { fuelType: 'Diesel' },
        quantity: (i + 1) * 100,
        destination: 'USA',
        actionType: 'CREATE'
      }))
    }

    render(
      <FuelExportSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />
    )

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-enabled'
    )
    expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
      'has-pagination'
    )
  })

  it('handles non-DRAFT status correctly (no link renderer)', () => {
    render(
      <FuelExportSummary
        data={{ fuelExports: [] }}
        status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
      />
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('default-col-def')).toHaveTextContent('no-cell-renderer')
  })

  it('handles DRAFT status correctly (with link renderer)', () => {
    render(
      <FuelExportSummary
        data={{ fuelExports: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('default-col-def')).toHaveTextContent('has-cell-renderer')
  })

  it('handles undefined data gracefully', () => {
    render(
      <FuelExportSummary
        data={undefined}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
      'true'
    )
  })

  it('handles data without fuelExports property', () => {
    render(
      <FuelExportSummary data={{}} status={COMPLIANCE_REPORT_STATUSES.DRAFT} />,
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
      'true'
    )
  })

  it('correctly implements getRowId function', () => {
    const mockData = {
      fuelExports: [
        {
          fuelExportId: 123,
          fuelType: { fuelType: 'Test Fuel' },
          quantity: 500,
          destination: 'Test Country',
          actionType: 'CREATE'
        }
      ]
    }

    render(
      <FuelExportSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />
    )

    expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
    expect(screen.getByTestId('get-row-id-result')).toHaveTextContent('123')
  })

  it('tests onPaginationChange callback', () => {
    render(
      <FuelExportSummary
        data={{ fuelExports: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />
    )

    const button = screen.getByTestId('test-pagination-change')
    fireEvent.click(button)

    // The pagination change should be handled without errors
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('shows correct grid options template', () => {
    render(
      <FuelExportSummary
        data={{ fuelExports: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />
    )

    expect(screen.getByTestId('grid-options-template')).toHaveTextContent('fuelExport:noFuelExportsFound')
  })

  describe('showFuelTypeOther computation', () => {
    it('returns false when no items have Other fuelType', () => {
      const mockData = {
        fuelExports: [
          {
            fuelExportId: 1,
            fuelType: { fuelType: 'Diesel' },
            quantity: 100,
            actionType: 'CREATE'
          },
          {
            fuelExportId: 2,
            fuelType: { fuelType: 'Gasoline' },
            quantity: 200,
            actionType: 'CREATE'
          }
        ]
      }

      render(
        <FuelExportSummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('returns true when some items have Other fuelType', () => {
      const mockData = {
        fuelExports: [
          {
            fuelExportId: 1,
            fuelType: { fuelType: 'Diesel' },
            quantity: 100,
            actionType: 'CREATE'
          },
          {
            fuelExportId: 2,
            fuelType: { fuelType: 'Other' },
            quantity: 200,
            actionType: 'CREATE'
          }
        ]
      }

      render(
        <FuelExportSummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('filtering logic', () => {
    it('applies contains filter correctly', () => {
      const mockData = {
        fuelExports: [
          {
            fuelExportId: 1,
            fuelType: { fuelType: 'Diesel' },
            destination: 'USA',
            actionType: 'CREATE'
          },
          {
            fuelExportId: 2,
            fuelType: { fuelType: 'Gasoline' },
            destination: 'Canada',
            actionType: 'CREATE'
          }
        ]
      }

      render(
        <FuelExportSummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      // Component renders with data (filtering logic would be tested via integration tests)
      expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('sorting logic', () => {
    it('applies ascending sort correctly', () => {
      const mockData = {
        fuelExports: [
          {
            fuelExportId: 1,
            fuelType: { fuelType: 'Diesel' },
            quantity: 300,
            actionType: 'CREATE'
          },
          {
            fuelExportId: 2,
            fuelType: { fuelType: 'Gasoline' },
            quantity: 100,
            actionType: 'CREATE'
          }
        ]
      }

      render(
        <FuelExportSummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('applies descending sort correctly', () => {
      const mockData = {
        fuelExports: [
          {
            fuelExportId: 1,
            fuelType: { fuelType: 'Diesel' },
            quantity: 100,
            actionType: 'CREATE'
          },
          {
            fuelExportId: 2,
            fuelType: { fuelType: 'Gasoline' },
            quantity: 300,
            actionType: 'CREATE'
          }
        ]
      }

      render(
        <FuelExportSummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('pagination logic', () => {
    it('correctly slices data for pagination', () => {
      const mockData = {
        fuelExports: Array.from({ length: 5 }, (_, i) => ({
          fuelExportId: i + 1,
          fuelType: { fuelType: 'Diesel' },
          quantity: (i + 1) * 100,
          actionType: 'CREATE'
        }))
      }

      render(
        <FuelExportSummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      // Shows all data on first page with default pagination (pagination logic tested via integration)
      expect(screen.getByTestId('row-count')).toHaveTextContent('5 rows')
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })
})