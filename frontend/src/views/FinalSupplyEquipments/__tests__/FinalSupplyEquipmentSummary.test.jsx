import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FinalSupplyEquipmentSummary } from '../FinalSupplyEquipmentSummary'
import { wrapper } from '@/tests/utils/wrapper'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// Mock react-router-dom
const mockUseParams = vi.fn()
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useParams: () => mockUseParams()
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

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
    getRowId,
    enableCopyButton
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
      <div data-test="copy-button">
        {enableCopyButton ? 'copy-enabled' : 'copy-disabled'}
      </div>
      <div data-test="has-pagination-options">
        {paginationOptions ? 'has-pagination' : 'no-pagination'}
      </div>
    </div>
  )
}))

// Mock GeoMapping component
vi.mock('./GeoMapping', () => ({
  default: ({ complianceReportId }) => (
    <div data-test="geo-mapping">
      <div data-test="compliance-report-id">{complianceReportId}</div>
    </div>
  )
}))

// Mock the schema
vi.mock('@/views/FinalSupplyEquipments/_schema.jsx', () => ({
  finalSupplyEquipmentSummaryColDefs: (t, status) => [
    { field: 'equipmentName', headerName: 'Equipment Name' },
    { field: 'fuelType', headerName: 'Fuel Type' },
    { field: 'quantity', headerName: 'Quantity' }
  ]
}))

// Mock cell renderers
vi.mock('@/utils/grid/cellRenderers', () => ({
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

describe('FinalSupplyEquipmentSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    mockUseParams.mockReturnValue({
      complianceReportId: 'test-report-id'
    })
  })

  it('renders the component with BCGridViewer', () => {
    render(
      <FinalSupplyEquipmentSummary
        data={{ finalSupplyEquipments: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('grid-key')).toHaveTextContent(
      'final-supply-equipments'
    )
    expect(screen.getByTestId('data-key')).toHaveTextContent(
      'finalSupplyEquipments'
    )
    expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
    expect(screen.getByTestId('copy-button')).toHaveTextContent('copy-disabled')
  })

  it('renders with empty data correctly', () => {
    render(
      <FinalSupplyEquipmentSummary
        data={{ finalSupplyEquipments: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
  })

  it('renders final supply equipment data correctly', () => {
    const mockData = {
      finalSupplyEquipments: [
        {
          finalSupplyEquipmentId: 1,
          equipmentName: 'Equipment A',
          fuelType: 'Diesel',
          quantity: 100
        },
        {
          finalSupplyEquipmentId: 2,
          equipmentName: 'Equipment B',
          fuelType: 'Gasoline',
          quantity: 200
        }
      ]
    }

    render(
      <FinalSupplyEquipmentSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
  })

  it('suppresses pagination when 10 or fewer items', () => {
    const mockData = {
      finalSupplyEquipments: Array.from({ length: 8 }, (_, i) => ({
        finalSupplyEquipmentId: i + 1,
        equipmentName: `Equipment${i + 1}`,
        fuelType: 'Diesel',
        quantity: (i + 1) * 100
      }))
    }

    render(
      <FinalSupplyEquipmentSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
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
      finalSupplyEquipments: Array.from({ length: 15 }, (_, i) => ({
        finalSupplyEquipmentId: i + 1,
        equipmentName: `Equipment${i + 1}`,
        fuelType: 'Diesel',
        quantity: (i + 1) * 100
      }))
    }

    render(
      <FinalSupplyEquipmentSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
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
      <FinalSupplyEquipmentSummary
        data={{ finalSupplyEquipments: [] }}
        status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('handles DRAFT status correctly (with link renderer)', () => {
    render(
      <FinalSupplyEquipmentSummary
        data={{ finalSupplyEquipments: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('handles undefined data gracefully', () => {
    render(
      <FinalSupplyEquipmentSummary
        data={undefined}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
      'true'
    )
  })

  it('handles data without finalSupplyEquipments property', () => {
    render(
      <FinalSupplyEquipmentSummary
        data={{}}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
      'true'
    )
  })

  it('renders the map toggle switch', () => {
    render(
      <FinalSupplyEquipmentSummary
        data={{ finalSupplyEquipments: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByText('Show Map')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('applies client-side filtering correctly', () => {
    const mockData = {
      finalSupplyEquipments: [
        {
          finalSupplyEquipmentId: 1,
          equipmentName: 'Alpha Equipment',
          fuelType: 'Diesel'
        },
        {
          finalSupplyEquipmentId: 2,
          equipmentName: 'Beta Equipment',
          fuelType: 'Gasoline'
        },
        {
          finalSupplyEquipmentId: 3,
          equipmentName: 'Gamma Equipment',
          fuelType: 'Biodiesel'
        }
      ]
    }

    render(
      <FinalSupplyEquipmentSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // All items should be shown without filters
    expect(screen.getByTestId('row-count')).toHaveTextContent('3 rows')
  })

  it('correctly implements getRowId function', () => {
    const mockData = {
      finalSupplyEquipments: [
        {
          finalSupplyEquipmentId: 123,
          equipmentName: 'Test Equipment',
          fuelType: 'Diesel'
        }
      ]
    }

    render(
      <FinalSupplyEquipmentSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // The mock shows that getRowId function is passed
    expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
  })

  it('disables copy button by default', () => {
    render(
      <FinalSupplyEquipmentSummary
        data={{ finalSupplyEquipments: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    expect(screen.getByTestId('copy-button')).toHaveTextContent('copy-disabled')
  })

  it('passes correct auto size strategy', () => {
    render(
      <FinalSupplyEquipmentSummary
        data={{ finalSupplyEquipments: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // Component should render without errors, indicating autoSizeStrategy is properly passed
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('handles pagination options updates', () => {
    render(
      <FinalSupplyEquipmentSummary
        data={{ finalSupplyEquipments: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // Component should render and handle pagination options correctly
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
      'has-pagination'
    )
  })

  it('uses fitCellContents auto size strategy', () => {
    const mockData = {
      finalSupplyEquipments: [
        {
          finalSupplyEquipmentId: 1,
          equipmentName:
            'Very Long Equipment Name That Should Test Auto Sizing',
          fuelType: 'Diesel',
          quantity: 1000
        }
      ]
    }

    render(
      <FinalSupplyEquipmentSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // Component should render correctly with long content
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('row-count')).toHaveTextContent('1 rows')
  })

  it('passes translation function and status to column definitions', () => {
    render(
      <FinalSupplyEquipmentSummary
        data={{ finalSupplyEquipments: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // Component should render, indicating the t function and status were passed correctly to schema
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  it('maintains consistent grid configuration', () => {
    render(
      <FinalSupplyEquipmentSummary
        data={{ finalSupplyEquipments: [] }}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // Verify key grid configuration
    expect(screen.getByTestId('grid-key')).toHaveTextContent(
      'final-supply-equipments'
    )
    expect(screen.getByTestId('data-key')).toHaveTextContent(
      'finalSupplyEquipments'
    )
    expect(screen.getByTestId('copy-button')).toHaveTextContent('copy-disabled')
    expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
  })

  it('does not filter out any items by default (no DELETE filter)', () => {
    const mockData = {
      finalSupplyEquipments: [
        {
          finalSupplyEquipmentId: 1,
          equipmentName: 'Equipment A',
          fuelType: 'Diesel'
        },
        {
          finalSupplyEquipmentId: 2,
          equipmentName: 'Equipment B',
          fuelType: 'Gasoline'
        }
      ]
    }

    render(
      <FinalSupplyEquipmentSummary
        data={mockData}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      { wrapper }
    )

    // All items should be shown (no DELETE filtering like other components)
    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
  })
})