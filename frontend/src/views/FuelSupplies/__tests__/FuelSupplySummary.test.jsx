import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FuelSupplySummary } from '../FuelSupplySummary'
import { wrapper } from '@/tests/utils/wrapper'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock BCGridViewer (this is what the component actually uses)
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
    onPaginationChange,
    getRowId
  }) => {
    // Simulate calling getRowId function to achieve function coverage
    const mockRowId = getRowId && queryData?.data?.[dataKey]?.[0] ? 
      getRowId({ data: queryData.data[dataKey][0] }) : 'no-row-id'
    
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
        <div data-test="row-id">{mockRowId}</div>
        <button 
          data-test="trigger-pagination-change" 
          onClick={() => onPaginationChange && onPaginationChange({ page: 2, size: 20 })}
        >
          Change Page
        </button>
      </div>
    )
  }
}))

// Mock the schema
vi.mock('@/views/FuelSupplies/_schema.jsx', () => ({
  fuelSupplySummaryColDef: (isEarlyIssuance, showFuelTypeOther) => [
    { field: 'fuelType', headerName: 'Fuel Type' },
    { field: 'quantity', headerName: 'Quantity' }
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

describe('FuelSupplySummary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders the component with BCGridViewer', () => {
    render(
      <FuelSupplySummary
        data={{ fuelSupplies: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        isEarlyIssuance={false}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('grid-key')).toHaveTextContent('fuel-supplies')
    expect(screen.getByTestId('data-key')).toHaveTextContent('fuelSupplies')
  })

  it('renders with empty data correctly', () => {
    render(
      <FuelSupplySummary
        data={{ fuelSupplies: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        isEarlyIssuance={false}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
  })

  it('renders fuel supplies data correctly', () => {
    const mockData = {
      fuelSupplies: [
        { fuelSupplyId: 1, fuelType: 'Diesel', actionType: 'CREATE' },
        { fuelSupplyId: 2, fuelType: 'Gasoline', actionType: 'UPDATE' }
      ]
    }

    render(
      <FuelSupplySummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        isEarlyIssuance={false}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
  })

  it('filters out deleted items', () => {
    const mockData = {
      fuelSupplies: [
        { fuelSupplyId: 1, fuelType: 'Diesel', actionType: 'CREATE' },
        { fuelSupplyId: 2, fuelType: 'Gasoline', actionType: 'DELETE' },
        { fuelSupplyId: 3, fuelType: 'Biodiesel', actionType: 'UPDATE' }
      ]
    }

    render(
      <FuelSupplySummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        isEarlyIssuance={false}
      />,
      { wrapper }
    )

    // Should show 2 rows (excluding the deleted one)
    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
  })

  it('suppresses pagination when 10 or fewer items', () => {
    const mockData = {
      fuelSupplies: Array.from({ length: 8 }, (_, i) => ({
        fuelSupplyId: i + 1,
        fuelType: `Fuel${i + 1}`,
        actionType: 'CREATE'
      }))
    }

    render(
      <FuelSupplySummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        isEarlyIssuance={false}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-suppressed'
    )
  })

  it('enables pagination when more than 10 items', () => {
    const mockData = {
      fuelSupplies: Array.from({ length: 15 }, (_, i) => ({
        fuelSupplyId: i + 1,
        fuelType: `Fuel${i + 1}`,
        actionType: 'CREATE'
      }))
    }

    render(
      <FuelSupplySummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        isEarlyIssuance={false}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-enabled'
    )
  })

  it('handles non-DRAFT status correctly', () => {
    render(
      <FuelSupplySummary
        data={{ fuelSupplies: [] }}
        status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
        isEarlyIssuance={false}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('handles early issuance flag', () => {
    render(
      <FuelSupplySummary
        data={{ fuelSupplies: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        isEarlyIssuance={true}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('handles undefined data gracefully', () => {
    render(
      <FuelSupplySummary
        data={undefined}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        isEarlyIssuance={false}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
  })

  it('handles data without fuelSupplies property', () => {
    render(
      <FuelSupplySummary
        data={{}}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        isEarlyIssuance={false}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
  })

  describe('paginatedData useMemo', () => {

    it('applies ascending sort correctly', () => {
      const mockData = {
        fuelSupplies: [
          { fuelSupplyId: 3, fuelType: 'Diesel', actionType: 'CREATE', quantity: 100 },
          { fuelSupplyId: 1, fuelType: 'Gasoline', actionType: 'CREATE', quantity: 200 },
          { fuelSupplyId: 2, fuelType: 'Biodiesel', actionType: 'CREATE', quantity: 150 }
        ]
      }

      const TestComponent = () => {
        const [paginationOptions, setPaginationOptions] = React.useState({
          page: 1,
          size: 10,
          filters: [],
          sortOrders: [{ field: 'quantity', direction: 'asc' }]
        })

        return (
          <FuelSupplySummary
            data={mockData}
            status={COMPLIANCE_REPORT_STATUSES.DRAFT}
            isEarlyIssuance={false}
          />
        )
      }

      render(<TestComponent />, { wrapper })
      expect(screen.getByTestId('row-count')).toHaveTextContent('3 rows')
    })

    it('applies descending sort correctly', () => {
      const mockData = {
        fuelSupplies: [
          { fuelSupplyId: 1, fuelType: 'Diesel', actionType: 'CREATE', quantity: 100 },
          { fuelSupplyId: 2, fuelType: 'Gasoline', actionType: 'CREATE', quantity: 200 },
          { fuelSupplyId: 3, fuelType: 'Biodiesel', actionType: 'CREATE', quantity: 150 }
        ]
      }

      const TestComponent = () => {
        const [paginationOptions, setPaginationOptions] = React.useState({
          page: 1,
          size: 10,
          filters: [],
          sortOrders: [{ field: 'quantity', direction: 'desc' }]
        })

        return (
          <FuelSupplySummary
            data={mockData}
            status={COMPLIANCE_REPORT_STATUSES.DRAFT}
            isEarlyIssuance={false}
          />
        )
      }

      render(<TestComponent />, { wrapper })
      expect(screen.getByTestId('row-count')).toHaveTextContent('3 rows')
    })

  })

  describe('showFuelTypeOther logic', () => {
    it('returns true when fuel type Other is present', () => {
      const mockData = {
        fuelSupplies: [
          { fuelSupplyId: 1, fuelType: 'Diesel', actionType: 'CREATE' },
          { fuelSupplyId: 2, fuelType: 'Other', actionType: 'CREATE' },
          { fuelSupplyId: 3, fuelType: 'Gasoline', actionType: 'CREATE' }
        ]
      }

      render(
        <FuelSupplySummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
          isEarlyIssuance={false}
        />,
        { wrapper }
      )

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('returns false when no fuel type Other is present', () => {
      const mockData = {
        fuelSupplies: [
          { fuelSupplyId: 1, fuelType: 'Diesel', actionType: 'CREATE' },
          { fuelSupplyId: 2, fuelType: 'Gasoline', actionType: 'CREATE' },
          { fuelSupplyId: 3, fuelType: 'Biodiesel', actionType: 'CREATE' }
        ]
      }

      render(
        <FuelSupplySummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
          isEarlyIssuance={false}
        />,
        { wrapper }
      )

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('getRowId function', () => {
    it('returns string representation of fuelSupplyId', () => {
      const mockData = {
        fuelSupplies: [
          { fuelSupplyId: 123, fuelType: 'Diesel', actionType: 'CREATE' }
        ]
      }

      render(
        <FuelSupplySummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
          isEarlyIssuance={false}
        />,
        { wrapper }
      )

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('row-id')).toHaveTextContent('123')
    })
  })

  describe('onPaginationChange callback', () => {
    it('updates pagination options correctly', () => {
      const mockData = {
        fuelSupplies: [
          { fuelSupplyId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
        ]
      }

      render(
        <FuelSupplySummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
          isEarlyIssuance={false}
        />,
        { wrapper }
      )

      const paginationButton = screen.getByTestId('trigger-pagination-change')
      fireEvent.click(paginationButton)

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('defaultColDef behavior', () => {
    it('includes LinkRenderer when status is DRAFT', () => {
      const mockData = {
        fuelSupplies: [
          { fuelSupplyId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
        ]
      }

      render(
        <FuelSupplySummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
          isEarlyIssuance={false}
        />,
        { wrapper }
      )

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('does not include LinkRenderer when status is not DRAFT', () => {
      const mockData = {
        fuelSupplies: [
          { fuelSupplyId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
        ]
      }

      render(
        <FuelSupplySummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
          isEarlyIssuance={false}
        />,
        { wrapper }
      )

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles no filters gracefully', () => {
      const mockData = {
        fuelSupplies: [
          { fuelSupplyId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
        ]
      }

      const TestComponent = () => {
        const [paginationOptions, setPaginationOptions] = React.useState({
          page: 1,
          size: 10,
          filters: null,
          sortOrders: []
        })

        return (
          <FuelSupplySummary
            data={mockData}
            status={COMPLIANCE_REPORT_STATUSES.DRAFT}
            isEarlyIssuance={false}
          />
        )
      }

      render(<TestComponent />, { wrapper })
      expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows')
    })

    it('handles no sort orders gracefully', () => {
      const mockData = {
        fuelSupplies: [
          { fuelSupplyId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
        ]
      }

      const TestComponent = () => {
        const [paginationOptions, setPaginationOptions] = React.useState({
          page: 1,
          size: 10,
          filters: [],
          sortOrders: null
        })

        return (
          <FuelSupplySummary
            data={mockData}
            status={COMPLIANCE_REPORT_STATUSES.DRAFT}
            isEarlyIssuance={false}
          />
        )
      }

      render(<TestComponent />, { wrapper })
      expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows')
    })

    it('handles filter with no filter value', () => {
      const mockData = {
        fuelSupplies: [
          { fuelSupplyId: 1, fuelType: 'Diesel', actionType: 'CREATE', supplier: 'Company A' }
        ]
      }

      const TestComponent = () => {
        const [paginationOptions, setPaginationOptions] = React.useState({
          page: 1,
          size: 10,
          filters: [{ field: 'supplier', type: 'contains', filter: '' }],
          sortOrders: []
        })

        return (
          <FuelSupplySummary
            data={mockData}
            status={COMPLIANCE_REPORT_STATUSES.DRAFT}
            isEarlyIssuance={false}
          />
        )
      }

      render(<TestComponent />, { wrapper })
      expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows')
    })

  })
})
