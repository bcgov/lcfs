import React from 'react'
import { render, screen } from '@testing-library/react'
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
    paginationOptions
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
    </div>
  )
}))

// Mock the schema
vi.mock('@/views/FuelSupplies/_schema.jsx', () => ({
  fuelSupplySummaryColDef: (isEarlyIssuance) => [
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
})
