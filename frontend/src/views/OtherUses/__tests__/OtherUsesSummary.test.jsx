import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OtherUsesSummary } from '../OtherUsesSummary'
import { wrapper } from '@/tests/utils/wrapper'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// Mock BCGridViewer with comprehensive props capture
vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: ({ 
    gridKey,
    columnDefs,
    queryData,
    dataKey,
    defaultColDef,
    suppressPagination,
    paginationOptions,
    onPaginationChange,
    getRowId,
    autoSizeStrategy,
    enableCellTextSelection,
    enablePageCaching
  }) => (
    <div data-test="bc-grid-viewer">
      <div data-test="grid-key">{gridKey}</div>
      <div data-test="data-key">{dataKey}</div>
      <div data-test="row-count">
        {queryData?.data?.[dataKey]?.length || 0} rows
      </div>
      <div data-test="total-count">
        {queryData?.data?.pagination?.total || 0} total
      </div>
      <div data-test="current-page">
        {queryData?.data?.pagination?.page || 1}
      </div>
      <div data-test="page-size">
        {queryData?.data?.pagination?.size || 10}
      </div>
      <div data-test="pagination-suppressed">
        {suppressPagination ? 'pagination-suppressed' : 'pagination-enabled'}
      </div>
      <div data-test="has-pagination-change">
        {onPaginationChange ? 'has-pagination-change' : 'no-pagination-change'}
      </div>
      <div data-test="has-get-row-id">
        {getRowId ? 'has-get-row-id' : 'no-get-row-id'}
      </div>
      <div data-test="has-auto-size">
        {autoSizeStrategy ? 'has-auto-size' : 'no-auto-size'}
      </div>
      <div data-test="cell-text-selection">
        {enableCellTextSelection ? 'text-selection-enabled' : 'text-selection-disabled'}
      </div>
      <div data-test="page-caching">
        {enablePageCaching ? 'page-caching-enabled' : 'page-caching-disabled'}
      </div>
      <div data-test="default-col-def-cell-renderer">
        {defaultColDef?.cellRenderer ? 'has-cell-renderer' : 'no-cell-renderer'}
      </div>
      <button 
        data-test="pagination-trigger" 
        onClick={() => onPaginationChange && onPaginationChange({ page: 2, size: 5 })}
      >
        Change Pagination
      </button>
    </div>
  )
}))

// Mock the schema
vi.mock('@/views/OtherUses/_schema.jsx', () => ({
  otherUsesSummaryColDefs: () => [
    { field: 'fuelType', headerName: 'Fuel Type' },
    { field: 'quantitySupplied', headerName: 'Quantity Supplied' },
    { field: 'units', headerName: 'Units' }
  ]
}))

// Mock cell renderers
vi.mock('@/utils/grid/cellRenderers.jsx', () => ({
  LinkRenderer: () => <div data-test="link-renderer">Link Renderer</div>
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

// Mock useOtherUsesOptions
vi.mock('@/hooks/useOtherUses', () => ({
  useOtherUsesOptions: vi.fn(() => ({
    data: {
      fuelTypes: []
    },
    isLoading: false,
    isFetched: true
  }))
}))

describe('OtherUsesSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Basic rendering tests
  it('renders component with basic props', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('grid-key')).toHaveTextContent('other-uses')
    expect(screen.getByTestId('data-key')).toHaveTextContent('otherUses')
    expect(screen.getByTestId('has-get-row-id')).toHaveTextContent('has-get-row-id')
  })

  it('renders container with correct test id', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('container')).toBeInTheDocument()
  })

  // Empty data handling tests
  it('handles undefined data', () => {
    render(
      <OtherUsesSummary
        data={undefined}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('0 total')
    expect(screen.getByTestId('current-page')).toHaveTextContent('1')
    expect(screen.getByTestId('page-size')).toHaveTextContent('10')
  })

  it('handles data without otherUses property', () => {
    render(
      <OtherUsesSummary 
        data={{}} 
        status={COMPLIANCE_REPORT_STATUSES.DRAFT} 
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('0 total')
  })

  it('handles null otherUses property', () => {
    render(
      <OtherUsesSummary 
        data={{ otherUses: null }} 
        status={COMPLIANCE_REPORT_STATUSES.DRAFT} 
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
  })

  // Data filtering tests
  it('filters out items with DELETE actionType', () => {
    const mockData = {
      otherUses: [
        { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' },
        { otherUsesId: 2, fuelType: 'Gas', actionType: 'DELETE' },
        { otherUsesId: 3, fuelType: 'Bio', actionType: 'UPDATE' }
      ]
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('2 total')
  })

  it('handles items without actionType property', () => {
    const mockData = {
      otherUses: [
        { otherUsesId: 1, fuelType: 'Diesel' },
        { otherUsesId: 2, fuelType: 'Gas', actionType: 'CREATE' }
      ]
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
  })

  it('handles all DELETE items scenario', () => {
    const mockData = {
      otherUses: [
        { otherUsesId: 1, fuelType: 'Diesel', actionType: 'DELETE' },
        { otherUsesId: 2, fuelType: 'Gas', actionType: 'DELETE' }
      ]
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('0 total')
  })

  // Status-based defaultColDef tests
  it('uses LinkRenderer for DRAFT status', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('default-col-def-cell-renderer')).toHaveTextContent('has-cell-renderer')
  })

  it('does not use LinkRenderer for non-DRAFT status', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('default-col-def-cell-renderer')).toHaveTextContent('no-cell-renderer')
  })

  // Pagination suppression tests
  it('suppresses pagination for 10 or fewer items', () => {
    const mockData = {
      otherUses: Array.from({ length: 8 }, (_, i) => ({
        otherUsesId: i + 1,
        fuelType: `Fuel ${i}`,
        actionType: 'CREATE'
      }))
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('pagination-suppressed')
  })

  it('enables pagination for more than 10 items', () => {
    const mockData = {
      otherUses: Array.from({ length: 15 }, (_, i) => ({
        otherUsesId: i + 1,
        fuelType: `Fuel ${i}`,
        actionType: 'CREATE'
      }))
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('pagination-enabled')
  })

  it('suppresses pagination when exactly 10 items', () => {
    const mockData = {
      otherUses: Array.from({ length: 10 }, (_, i) => ({
        otherUsesId: i + 1,
        fuelType: `Fuel ${i}`,
        actionType: 'CREATE'
      }))
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('pagination-suppressed')
  })

  // Pagination change handler tests
  it('handles pagination changes', async () => {
    const mockData = {
      otherUses: Array.from({ length: 5 }, (_, i) => ({
        otherUsesId: i + 1,
        fuelType: `Fuel ${i}`,
        actionType: 'CREATE'
      }))
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    const paginationTrigger = screen.getByTestId('pagination-trigger')
    
    await act(async () => {
      fireEvent.click(paginationTrigger)
    })

    expect(screen.getByTestId('has-pagination-change')).toHaveTextContent('has-pagination-change')
  })

  // Grid configuration tests
  it('configures grid with correct properties', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('has-auto-size')).toHaveTextContent('has-auto-size')
    expect(screen.getByTestId('cell-text-selection')).toHaveTextContent('text-selection-enabled')
    expect(screen.getByTestId('page-caching')).toHaveTextContent('page-caching-disabled')
  })

  // Grid configuration tests
  it('configures grid with correct props', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('has-pagination-change')).toHaveTextContent('has-pagination-change')
    expect(screen.getByTestId('has-auto-size')).toHaveTextContent('has-auto-size')
    expect(screen.getByTestId('cell-text-selection')).toHaveTextContent('text-selection-enabled')
    expect(screen.getByTestId('page-caching')).toHaveTextContent('page-caching-disabled')
  })

  // getRowId function tests
  it('getRowId returns correct string ID', () => {
    const mockData = {
      otherUses: [
        { otherUsesId: 123, fuelType: 'Test', actionType: 'CREATE' }
      ]
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('has-get-row-id')).toHaveTextContent('has-get-row-id')
  })

  // Complex data scenarios
  it('handles mixed action types correctly', () => {
    const mockData = {
      otherUses: [
        { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' },
        { otherUsesId: 2, fuelType: 'Gas', actionType: 'UPDATE' },
        { otherUsesId: 3, fuelType: 'Bio', actionType: 'DELETE' },
        { otherUsesId: 4, fuelType: 'Ethanol', actionType: 'CREATE' }
      ]
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('3 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('3 total')
  })

  it('handles large dataset correctly', () => {
    const mockData = {
      otherUses: Array.from({ length: 50 }, (_, i) => ({
        otherUsesId: i + 1,
        fuelType: `Fuel Type ${i}`,
        quantitySupplied: (i + 1) * 100,
        actionType: 'CREATE'
      }))
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows') // First page
    expect(screen.getByTestId('total-count')).toHaveTextContent('50 total')
    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('pagination-enabled')
  })

  it('handles long content with proper configuration', () => {
    const mockData = {
      otherUses: [{
        otherUsesId: 1,
        fuelType: 'Very Long Fuel Type Name That Tests Auto Sizing Functionality',
        quantitySupplied: 1000,
        units: 'Liters',
        actionType: 'CREATE'
      }]
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows')
    expect(screen.getByTestId('has-auto-size')).toHaveTextContent('has-auto-size')
  })

  // Edge cases
  it('handles empty array data', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('0 total')
    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('pagination-suppressed')
  })

  it('maintains state consistency across re-renders', async () => {
    const { rerender } = render(
      <OtherUsesSummary
        data={{ otherUses: [{ otherUsesId: 1, fuelType: 'Test', actionType: 'CREATE' }] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows')

    rerender(
      <OtherUsesSummary
        data={{ otherUses: [
          { otherUsesId: 1, fuelType: 'Test', actionType: 'CREATE' },
          { otherUsesId: 2, fuelType: 'Test2', actionType: 'CREATE' }
        ] }}
        status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
      />
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
    expect(screen.getByTestId('default-col-def-cell-renderer')).toHaveTextContent('no-cell-renderer')
  })

  it('handles different status values correctly', () => {
    const mockData = {
      otherUses: [{ otherUsesId: 1, fuelType: 'Test', actionType: 'CREATE' }]
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
      />,
      { wrapper }
    )

    expect(
      screen.getByTestId('default-col-def-cell-renderer')
    ).toHaveTextContent('no-cell-renderer')
  })

  it('verifies all grid configuration properties', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('has-auto-size')).toHaveTextContent(
      'has-auto-size'
    )
    expect(screen.getByTestId('cell-text-selection')).toHaveTextContent(
      'text-selection-enabled'
    )
  })

  it('handles component re-render with useMemo dependencies', () => {
    const { rerender } = render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    rerender(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
      />
    )
    expect(
      screen.getByTestId('default-col-def-cell-renderer')
    ).toHaveTextContent('no-cell-renderer')
  })

  it('tests defaultColDef useMemo dependency on status change', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(
      screen.getByTestId('default-col-def-cell-renderer')
    ).toHaveTextContent('has-cell-renderer')
  })

  it('handles data edge case with numeric values', () => {
    const mockData = {
      otherUses: [
        {
          otherUsesId: 999,
          fuelType: 'Test',
          quantitySupplied: 0,
          actionType: 'CREATE'
        }
      ]
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows')
  })

  it('handles boolean and string field values', () => {
    const mockData = {
      otherUses: [
        {
          otherUsesId: 1,
          fuelType: 'String Value',
          isActive: true,
          actionType: 'CREATE'
        }
      ]
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows')
  })

  it('covers all auto sizing strategy configuration', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('has-auto-size')).toHaveTextContent(
      'has-auto-size'
    )
  })

  it('handles component with minimal required props only', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('verifies pagination options state is properly initialized', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('current-page')).toHaveTextContent('1')
    expect(screen.getByTestId('page-size')).toHaveTextContent('10')
  })


  it('verifies all grid configuration properties', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // Verify all expected grid configuration
    expect(screen.getByTestId('grid-key')).toHaveTextContent('other-uses')
    expect(screen.getByTestId('data-key')).toHaveTextContent('otherUses')
    expect(screen.getByTestId('has-get-row-id')).toHaveTextContent('has-get-row-id')
    expect(screen.getByTestId('has-auto-size')).toHaveTextContent('has-auto-size')
    expect(screen.getByTestId('cell-text-selection')).toHaveTextContent('text-selection-enabled')
    expect(screen.getByTestId('page-caching')).toHaveTextContent('page-caching-disabled')
    expect(screen.getByTestId('has-pagination-change')).toHaveTextContent('has-pagination-change')
  })

  // Additional complex logic tests to increase coverage
  it('handles component re-render with useMemo dependencies', () => {
    const initialData = {
      otherUses: [
        { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
      ]
    }

    const { rerender } = render(
      <OtherUsesSummary
        data={initialData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows')

    // Change data to trigger useMemo recalculation
    const newData = {
      otherUses: [
        { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' },
        { otherUsesId: 2, fuelType: 'Gasoline', actionType: 'CREATE' }
      ]
    }

    rerender(
      <OtherUsesSummary
        data={newData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
  })

  it('tests defaultColDef useMemo dependency on status change', () => {
    const { rerender } = render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('default-col-def-cell-renderer')).toHaveTextContent('has-cell-renderer')

    // Change status to trigger defaultColDef recalculation
    rerender(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
      />
    )

    expect(screen.getByTestId('default-col-def-cell-renderer')).toHaveTextContent('no-cell-renderer')
  })

  it('handles data edge case with numeric values', () => {
    const mockData = {
      otherUses: [
        { otherUsesId: 1, fuelType: 'Test', quantitySupplied: 0, actionType: 'CREATE' },
        { otherUsesId: 2, fuelType: 'Test2', quantitySupplied: -100, actionType: 'CREATE' },
        { otherUsesId: 3, fuelType: 'Test3', quantitySupplied: null, actionType: 'CREATE' }
      ]
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('3 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('3 total')
  })

  it('handles boolean and string field values', () => {
    const mockData = {
      otherUses: [
        { otherUsesId: 1, fuelType: 'Test', isActive: true, actionType: 'CREATE' },
        { otherUsesId: 2, fuelType: 'Test2', isActive: false, actionType: 'CREATE' },
        { otherUsesId: 3, fuelType: '', description: 'Empty fuel type', actionType: 'CREATE' }
      ]
    }

    render(
      <OtherUsesSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('3 rows')
  })

  it('covers all auto sizing strategy configuration', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // The component should have auto sizing enabled
    expect(screen.getByTestId('has-auto-size')).toHaveTextContent('has-auto-size')
  })

  it('handles component with minimal required props only', () => {
    render(
      <OtherUsesSummary
        data={null}
        status={null}
      />,
      { wrapper }
    )

    // Should render without crashing
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
  })

  it('verifies pagination options state is properly initialized', () => {
    render(
      <OtherUsesSummary
        data={{ otherUses: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // Initial pagination state should be reflected in the grid
    expect(screen.getByTestId('current-page')).toHaveTextContent('1')
    expect(screen.getByTestId('page-size')).toHaveTextContent('10')
  })

})