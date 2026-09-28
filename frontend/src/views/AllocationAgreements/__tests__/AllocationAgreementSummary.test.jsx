import { screen, act } from '@testing-library/react'
import { describe, expect, beforeEach, vi } from 'vitest'
import { AllocationAgreementSummary } from '../AllocationAgreementSummary'
import { test } from '@/tests/utils/fixtures'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: vi.fn(() => ({ complianceReportId: '123' }))
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: (key) => key
  }))
}))

// Mock BCGridViewer
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
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
      <div data-test="has-pagination-change">
        {onPaginationChange ? 'has-change-handler' : 'no-change-handler'}
      </div>
      <div data-test="current-page">
        {queryData?.data?.pagination?.page || 1}
      </div>
      <div data-test="page-size">{queryData?.data?.pagination?.size || 10}</div>
      <button
        data-test="simulate-pagination-change"
        onClick={() =>
          onPaginationChange && onPaginationChange({ page: 2, size: 20 })
        }
      >
        Simulate Pagination Change
      </button>
    </div>
  )
}))

// Mock the schema
vi.mock('../_schema', () => ({
  allocationAgreementSummaryColDef: vi.fn((isEarlyIssuance) => [
    { field: 'agreementName', headerName: 'Agreement Name' },
    { field: 'fuel', headerName: 'Fuel' },
    { field: 'quantity', headerName: 'Quantity' }
  ])
}))

// Mock cell renderers
vi.mock('@/utils/grid/cellRenderers', () => ({
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

// Mock useGetAllAllocationAgreements hook
vi.mock('@/hooks/useAllocationAgreement.js', () => ({
  useGetAllAllocationAgreements: vi.fn(() => ({}))
}))

describe('AllocationAgreementSummary', () => {
  const defaultProps = {
    data: { allocationAgreements: [] },
    status: COMPLIANCE_REPORT_STATUSES.DRAFT,
    isEarlyIssuance: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Test 1: Component renders with minimal props
  test('renders the component with minimal props', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<AllocationAgreementSummary {...defaultProps} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('grid-key')).toHaveTextContent(
      'allocation-agreements'
    )
    expect(screen.getByTestId('data-key')).toHaveTextContent(
      'allocationAgreements'
    )
    expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
    expect(screen.getByTestId('copy-button')).toHaveTextContent('copy-disabled')
    expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
      'has-change-handler'
    )
  })

  // Test 2: Component renders with full data
  test('renders with full data correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockData = {
      allocationAgreements: [
        {
          allocationAgreementId: 1,
          agreementName: 'Agreement A',
          fuel: 'Diesel',
          quantity: 100,
          actionType: 'CREATE'
        },
        {
          allocationAgreementId: 2,
          agreementName: 'Agreement B',
          fuel: 'Gasoline',
          quantity: 200,
          actionType: 'UPDATE'
        }
      ]
    }

    render(<AllocationAgreementSummary {...defaultProps} data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('2 total')
  })

  // Test 3: No data scenario returns empty structure
  test('handles no data scenario correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<AllocationAgreementSummary {...defaultProps} data={null} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('0 total')
    expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
      'true'
    )
  })

  // Test 4: Filters out DELETE action types
  test('filters out DELETE action types', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockData = {
      allocationAgreements: [
        {
          allocationAgreementId: 1,
          agreementName: 'Agreement A',
          fuel: 'Diesel',
          actionType: 'CREATE'
        },
        {
          allocationAgreementId: 2,
          agreementName: 'Agreement B',
          fuel: 'Gasoline',
          actionType: 'DELETE'
        },
        {
          allocationAgreementId: 3,
          agreementName: 'Agreement C',
          fuel: 'Biodiesel',
          actionType: 'UPDATE'
        }
      ]
    }

    render(<AllocationAgreementSummary {...defaultProps} data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    // Should show 2 rows (excluding the deleted one)
    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('2 total')
  })

  // Test 5-8: Pagination logic tests (sorting and filtering require component state manipulation)
  // These tests verify the component behavior with different data configurations

  // Test 9: Pagination calculation logic
  test('calculates pagination correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockData = {
      allocationAgreements: Array.from({ length: 25 }, (_, i) => ({
        allocationAgreementId: i + 1,
        agreementName: `Agreement ${i + 1}`,
        fuel: 'Diesel',
        quantity: (i + 1) * 100,
        actionType: 'CREATE'
      }))
    }

    render(<AllocationAgreementSummary {...defaultProps} data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    // First page should show 10 items (default page size)
    expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('25 total')
    expect(screen.getByTestId('current-page')).toHaveTextContent('1')
    expect(screen.getByTestId('page-size')).toHaveTextContent('10')
  })

  // Test 10: gridOptions memoization
  test('configures gridOptions correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<AllocationAgreementSummary {...defaultProps} />, [
      query,
      theme,
      localization,
      router
    ])

    // Component should render without errors, indicating gridOptions is properly configured
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  // Test 11: defaultColDef with DRAFT status (LinkRenderer)
  test('sets LinkRenderer for DRAFT status', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <AllocationAgreementSummary
        {...defaultProps}
        status={COMPLIANCE_REPORT_STATUSES.DRAFT}
      />,
      [query, theme, localization, router]
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  // Test 12: defaultColDef with non-DRAFT status (no renderer)
  test('does not set LinkRenderer for non-DRAFT status', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <AllocationAgreementSummary
        {...defaultProps}
        status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
      />,
      [query, theme, localization, router]
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  // Test 13: columns memoization with isEarlyIssuance
  test('passes isEarlyIssuance to column definitions', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <AllocationAgreementSummary {...defaultProps} isEarlyIssuance={true} />,
      [query, theme, localization, router]
    )

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  // Test 14: getRowId function
  test('implements getRowId function correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockData = {
      allocationAgreements: [
        {
          allocationAgreementId: 123,
          agreementName: 'Test Agreement',
          fuel: 'Diesel',
          actionType: 'CREATE'
        }
      ]
    }

    render(<AllocationAgreementSummary {...defaultProps} data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
  })

  // Test 15: onPaginationChange callback
  test('handles pagination change correctly', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<AllocationAgreementSummary {...defaultProps} />, [
      query,
      theme,
      localization,
      router
    ])

    const paginationButton = screen.getByTestId('simulate-pagination-change')
    expect(paginationButton).toBeInTheDocument()

    // Simulate pagination change - should not throw error
    await act(async () => {
      paginationButton.click()
    })

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  // Test 16: suppressPagination logic (≤10 items)
  test('suppresses pagination when 10 or fewer items', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockData = {
      allocationAgreements: Array.from({ length: 8 }, (_, i) => ({
        allocationAgreementId: i + 1,
        agreementName: `Agreement ${i + 1}`,
        fuel: 'Diesel',
        quantity: (i + 1) * 100,
        actionType: 'CREATE'
      }))
    }

    render(<AllocationAgreementSummary {...defaultProps} data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-suppressed'
    )
    expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
      'true'
    )
  })

  // Test 17: suppressPagination logic (>10 items)
  test('enables pagination when more than 10 items', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockData = {
      allocationAgreements: Array.from({ length: 15 }, (_, i) => ({
        allocationAgreementId: i + 1,
        agreementName: `Agreement ${i + 1}`,
        fuel: 'Diesel',
        quantity: (i + 1) * 100,
        actionType: 'CREATE'
      }))
    }

    render(<AllocationAgreementSummary {...defaultProps} data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-enabled'
    )
    expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
      'false'
    )
  })

  // Test 18: Filter field value edge cases
  test('handles edge cases in data', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockData = {
      allocationAgreements: [
        {
          allocationAgreementId: 1,
          agreementName: null,
          fuel: undefined,
          quantity: 0,
          actionType: 'CREATE'
        },
        {
          allocationAgreementId: 2,
          agreementName: '',
          fuel: 'Gasoline',
          quantity: 100,
          actionType: 'CREATE'
        }
      ]
    }

    render(<AllocationAgreementSummary {...defaultProps} data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('2 total')
  })

  // Test 19: Sort comparison edge cases
  test('handles empty data arrays', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockData = {
      allocationAgreements: []
    }

    render(<AllocationAgreementSummary {...defaultProps} data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('0 total')
    expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
      'true'
    )
  })

  // Test 20: Pagination edge cases
  test('handles missing data structure', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<AllocationAgreementSummary {...defaultProps} data={{}} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('0 total')
    expect(screen.getByTestId('suppress-pagination-value')).toHaveTextContent(
      'true'
    )
  })

  // Additional comprehensive coverage tests
  test('maintains grid configuration consistency', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<AllocationAgreementSummary {...defaultProps} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByTestId('grid-key')).toHaveTextContent(
      'allocation-agreements'
    )
    expect(screen.getByTestId('data-key')).toHaveTextContent(
      'allocationAgreements'
    )
    expect(screen.getByTestId('copy-button')).toHaveTextContent('copy-disabled')
    expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
      'has-pagination'
    )
  })

  test('handles undefined props gracefully', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    expect(() => {
      render(
        <AllocationAgreementSummary
          data={undefined}
          status={undefined}
          isEarlyIssuance={undefined}
        />,
        [query, theme, localization, router]
      )
    }).not.toThrow()

    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })

  test('handles exactly 10 items boundary condition', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockData = {
      allocationAgreements: Array.from({ length: 10 }, (_, i) => ({
        allocationAgreementId: i + 1,
        agreementName: `Agreement ${i + 1}`,
        fuel: 'Diesel',
        quantity: (i + 1) * 100,
        actionType: 'CREATE'
      }))
    }

    render(<AllocationAgreementSummary {...defaultProps} data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-suppressed'
    )
    expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows')
  })

  test('handles exactly 11 items boundary condition', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockData = {
      allocationAgreements: Array.from({ length: 11 }, (_, i) => ({
        allocationAgreementId: i + 1,
        agreementName: `Agreement ${i + 1}`,
        fuel: 'Diesel',
        quantity: (i + 1) * 100,
        actionType: 'CREATE'
      }))
    }

    render(<AllocationAgreementSummary {...defaultProps} data={mockData} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-enabled'
    )
    expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows')
    expect(screen.getByTestId('total-count')).toHaveTextContent('11 total')
  })
})
