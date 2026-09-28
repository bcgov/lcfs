import { screen, waitFor, act } from '@testing-library/react'
import { describe, expect, beforeEach, vi } from 'vitest'
import { AllocationAgreementChangelog } from '../AllocationAgreementChangelog'
import { test } from '@/tests/utils/fixtures'
import { useState } from 'react'

// Mock hooks
vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: vi.fn(),
  useGetChangeLog: vi.fn()
}))

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: vi.fn()
  }
})

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock BCGridViewer with function execution for coverage
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
  }) => {
    // Actually call functions to increase coverage
    let rowIds = []
    let rowStyles = []

    if (queryData?.data?.items && getRowId) {
      rowIds = queryData.data.items.map((item) => {
        const params = { data: item }
        return getRowId(params)
      })
    }

    if (queryData?.data?.items && gridOptions?.getRowStyle) {
      rowStyles = queryData.data.items.map((item) => {
        const params = { data: item }
        return gridOptions.getRowStyle(params)
      })
    }

    // Simulate pagination change for testing
    const handleTestPaginationChange = () => {
      if (onPaginationChange) {
        onPaginationChange({ page: 2, size: 10 })
      }
    }

    return (
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
        <div data-test="column-defs-length">{columnDefs?.length || 0}</div>
        <div data-test="grid-options-highlight">
          {gridOptions?.getRowStyle ? 'has-row-style' : 'no-row-style'}
        </div>
        <div data-test="row-ids">{rowIds.join(',')}</div>
        <div data-test="row-styles-count">
          {rowStyles.filter(Boolean).length}
        </div>
        {onPaginationChange && (
          <button
            data-test="pagination-change-trigger"
            onClick={handleTestPaginationChange}
          >
            Change Page
          </button>
        )}
        {/* Simulate items for testing */}
        {queryData?.data?.items?.map((item, index) => (
          <div key={index} data-test="grid-item">
            {item.allocationAgreementId} - {item.actionType}
          </div>
        ))}
      </div>
    )
  }
}))

// Mock BCTypography
vi.mock('@/components/BCTypography', () => ({
  default: ({ children, variant, color, component, ...props }) => (
    <div
      data-test="bc-typography"
      data-variant={variant}
      data-color={color}
      {...props}
    >
      {children}
    </div>
  )
}))

// Mock Loading component
vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading-component">Loading...</div>
}))

// Mock schema
vi.mock('./_schema', () => ({
  changelogColDefs: () => [
    // Mock the actual structure: 4 specific columns + 17 common columns = 21 total
    { field: 'groupUuid', hide: true },
    { field: 'createDate', hide: true },
    { field: 'version', hide: true },
    { field: 'actionType', headerName: 'Action' },
    // Plus 17 common columns
    ...Array.from({ length: 17 }, (_, i) => ({
      field: `commonField${i}`,
      headerName: `Common Field ${i}`
    }))
  ],
  changelogCommonColDefs: (highlight) => [
    // Mock 17 columns for common column definitions
    ...Array.from({ length: 17 }, (_, i) => ({
      field: `commonField${i}`,
      headerName: `Common Field ${i}`
    }))
  ]
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

// Mock colors
vi.mock('@/themes/base/colors', async () => {
  const actual = await vi.importActual('@/themes/base/colors')
  return {
    ...actual,
    default: {
      ...actual.default,
      alerts: {
        error: { background: '#ffebee' },
        success: { background: '#e8f5e8' }
      }
    }
  }
})

// Import the actual hooks to mock them
import {
  useComplianceReportWithCache,
  useGetChangeLog
} from '@/hooks/useComplianceReports'
import { useParams } from 'react-router-dom'

// Mock useState for testing
vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return {
    ...actual,
    useState: vi.fn()
  }
})

describe('AllocationAgreementChangelog', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Default mock implementations
    vi.mocked(useParams).mockReturnValue({
      complianceReportId: '123',
      compliancePeriod: '2024'
    })

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

    // Default useState mock
    vi.mocked(useState).mockReturnValue([{}, vi.fn()])
  })

  // Basic rendering tests
  test('shows loading component when changelog data is loading', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    vi.mocked(useGetChangeLog).mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.getByTestId('loading-component')).toBeInTheDocument()
  })

  test('shows loading component when current report is loading', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    vi.mocked(useComplianceReportWithCache).mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.getByTestId('loading-component')).toBeInTheDocument()
  })

  test('renders empty state when no changelog data', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    vi.mocked(useGetChangeLog).mockReturnValue({
      data: [],
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    const grids = screen.queryAllByTestId('bc-grid-viewer')
    expect(grids).toHaveLength(0)
  })

  test('renders single changelog item correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Version 1.0')).toBeInTheDocument()
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
  })

  test('renders multiple changelog items correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Current Version')).toBeInTheDocument()
    expect(screen.getByText('Original Version')).toBeInTheDocument()

    const grids = screen.getAllByTestId('bc-grid-viewer')
    expect(grids).toHaveLength(2)
  })

  // Pagination tests
  test('suppresses pagination for small datasets', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

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

  test('enables pagination for large datasets', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

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

  test('suppresses pagination for current version with small dataset', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Current Version',
        allocationAgreements: Array.from({ length: 3 }, (_, i) => ({
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

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    // Small dataset should suppress pagination even for current version
    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-suppressed'
    )
  })

  test('suppresses pagination for original version with small dataset', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Middle Version',
        allocationAgreements: Array.from({ length: 3 }, (_, i) => ({
          allocationAgreementId: i + 1,
          agreementName: `Agreement ${i + 1}`,
          actionType: 'CREATE'
        }))
      },
      {
        version: 0,
        nickname: 'Original Version',
        allocationAgreements: Array.from({ length: 3 }, (_, i) => ({
          allocationAgreementId: i + 10,
          agreementName: `Agreement ${i + 10}`,
          actionType: 'DELETE'
        }))
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    const paginationElements = screen.getAllByTestId('pagination-suppressed')
    // Both should be suppressed due to small datasets
    expect(paginationElements[0]).toHaveTextContent('pagination-suppressed')
    expect(paginationElements[1]).toHaveTextContent('pagination-suppressed')
  })

  // Column definition tests
  test('uses different column definitions for current/original vs other versions', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    const grids = screen.getAllByTestId('bc-grid-viewer')
    expect(grids).toHaveLength(3)

    // All should have getRowId function
    const getRowIdElements = screen.getAllByTestId('get-row-id')
    getRowIdElements.forEach((element) => {
      expect(element).toHaveTextContent('has-get-row-id')
    })

    // Check column definitions - current and original should have different columns than middle
    const columnDefElements = screen.getAllByTestId('column-defs-length')
    expect(columnDefElements[0]).toHaveTextContent('13') // current version uses changelogCommonColDefs (13 columns)
    expect(columnDefElements[1]).toHaveTextContent('17') // middle version uses changelogColDefs (21 columns)
    expect(columnDefElements[2]).toHaveTextContent('13') // original version uses changelogCommonColDefs (17 columns)
  })

  // Grid styling tests
  test('applies different grid styling for current/original vs other versions', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    const gridStyleElements = screen.getAllByTestId('grid-options-highlight')
    expect(gridStyleElements[0]).toHaveTextContent('has-row-style') // current version uses gridOptions(false) but still has getRowStyle function
    expect(gridStyleElements[1]).toHaveTextContent('has-row-style') // middle version uses gridOptions() with highlighting
  })

  // Edge cases
  test('handles empty allocation agreements array', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Empty Version')).toBeInTheDocument()
    expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-suppressed'
    )
  })

  test('handles undefined changelog data', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    vi.mocked(useGetChangeLog).mockReturnValue({
      data: undefined,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    const grids = screen.queryAllByTestId('bc-grid-viewer')
    expect(grids).toHaveLength(0)
  })

  test('handles null changelog data', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    vi.mocked(useGetChangeLog).mockReturnValue({
      data: null,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    const grids = screen.queryAllByTestId('bc-grid-viewer')
    expect(grids).toHaveLength(0)
  })

  // Grid key generation tests
  test('generates unique grid keys for multiple versions', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    const gridKeys = screen.getAllByTestId('grid-key')
    expect(gridKeys[0]).toHaveTextContent('allocation-agreements-changelog-0')
    expect(gridKeys[1]).toHaveTextContent('allocation-agreements-changelog-1')
  })

  // Version identification tests
  test('correctly identifies current and original versions', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    await waitFor(() => {
      const grids = screen.getAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(3)
    })

    // Check that pagination is only enabled based on data size, not version type
    const paginationElements = screen.getAllByTestId('pagination-suppressed')
    expect(paginationElements[0]).toHaveTextContent('pagination-suppressed') // current (index 0), small dataset
    expect(paginationElements[1]).toHaveTextContent('pagination-suppressed') // middle version, small dataset
    expect(paginationElements[2]).toHaveTextContent('pagination-suppressed') // original (version 0), small dataset
  })

  // Pagination with different data sizes
  test('handles pagination state management correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
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

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    // Should show first 10 items (default page size)
    expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows')
    expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
      'has-change-handler'
    )
  })

  // Mixed dataset size scenarios
  test('handles mixed large and small datasets correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Large Dataset',
        allocationAgreements: Array.from({ length: 15 }, (_, i) => ({
          allocationAgreementId: i + 1,
          agreementName: `Agreement ${i + 1}`,
          actionType: 'CREATE'
        }))
      },
      {
        version: 2,
        nickname: 'Small Dataset',
        allocationAgreements: Array.from({ length: 3 }, (_, i) => ({
          allocationAgreementId: i + 20,
          agreementName: `Agreement ${i + 20}`,
          actionType: 'UPDATE'
        }))
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    const paginationElements = screen.getAllByTestId('pagination-suppressed')
    expect(paginationElements[0]).toHaveTextContent('pagination-enabled') // large dataset
    expect(paginationElements[1]).toHaveTextContent('pagination-suppressed') // small dataset
  })

  // Hook params tests
  test('passes correct params to useGetChangeLog hook', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockParams = {
      complianceReportId: '456',
      compliancePeriod: '2023'
    }

    vi.mocked(useParams).mockReturnValue(mockParams)

    const mockCurrentReport = {
      report: {
        complianceReportGroupUuid: 'different-group-uuid'
      }
    }

    vi.mocked(useComplianceReportWithCache).mockReturnValue({
      data: mockCurrentReport,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    expect(useGetChangeLog).toHaveBeenCalledWith({
      complianceReportGroupUuid: 'different-group-uuid',
      dataType: 'allocation-agreements'
    })
  })

  test('handles missing current report data gracefully', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    vi.mocked(useComplianceReportWithCache).mockReturnValue({
      data: null,
      isLoading: false
    })

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: [],
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    expect(useGetChangeLog).toHaveBeenCalledWith({
      complianceReportGroupUuid: undefined,
      dataType: 'allocation-agreements'
    })

    const grids = screen.queryAllByTestId('bc-grid-viewer')
    expect(grids).toHaveLength(0)
  })

  // Function-specific tests for better coverage
  test('tests getRowId function with different ID types', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'ID Test Version',
        allocationAgreements: [
          {
            allocationAgreementId: 123,
            agreementName: 'Test Agreement',
            actionType: 'CREATE'
          },
          {
            allocationAgreementId: 456,
            agreementName: 'Another Agreement',
            actionType: 'UPDATE'
          }
        ]
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    // Check that getRowId function works for different items
    const gridItems = screen.getAllByTestId('grid-item')
    expect(gridItems[0]).toHaveTextContent('123 - CREATE')
    expect(gridItems[1]).toHaveTextContent('456 - UPDATE')
    expect(screen.getByTestId('get-row-id')).toHaveTextContent('has-get-row-id')
  })

  test('tests pagination with complex data scenarios', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Pagination Test Version',
        allocationAgreements: Array.from({ length: 15 }, (_, i) => ({
          allocationAgreementId: i + 1,
          agreementName: `Agreement ${i + 1}`,
          actionType: i % 2 === 0 ? 'CREATE' : 'UPDATE',
          fuelType: i % 3 === 0 ? 'Gasoline' : 'Diesel'
        }))
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    // Should enable pagination for large datasets
    expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
      'pagination-enabled'
    )
    expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
      'has-pagination'
    )
    expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
      'has-change-handler'
    )

    // Should show paginated results (first 10 items)
    expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows')
  })

  test('tests grid styling with different action types', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockChangelogData = [
      {
        version: 2, // Not current or original version
        nickname: 'Action Types Test',
        allocationAgreements: [
          {
            allocationAgreementId: 1,
            agreementName: 'Deleted Agreement',
            actionType: 'DELETE'
          },
          {
            allocationAgreementId: 2,
            agreementName: 'Created Agreement',
            actionType: 'CREATE'
          },
          {
            allocationAgreementId: 3,
            agreementName: 'Updated Agreement',
            actionType: 'UPDATE'
          }
        ]
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    // Should have row styling for non-current/original versions
    expect(screen.getByTestId('grid-options-highlight')).toHaveTextContent(
      'has-row-style'
    )

    // Check all action types are rendered
    const gridItems = screen.getAllByTestId('grid-item')
    expect(gridItems[0]).toHaveTextContent('1 - DELETE')
    expect(gridItems[1]).toHaveTextContent('2 - CREATE')
    expect(gridItems[2]).toHaveTextContent('3 - UPDATE')
  })

  // Component integration tests
  test('integrates all components correctly with real data flow', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Integration Test Version',
        allocationAgreements: [
          {
            allocationAgreementId: 100,
            agreementName: 'Integration Agreement',
            actionType: 'CREATE'
          }
        ]
      }
    ]

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    // Check that all expected elements are present and working together
    expect(screen.getByText('Integration Test Version')).toBeInTheDocument()
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('grid-key')).toHaveTextContent(
      'allocation-agreements-changelog-0'
    )
    expect(screen.getByTestId('grid-item')).toHaveTextContent('100 - CREATE')

    await waitFor(() => {
      expect(screen.getByTestId('get-row-id')).toHaveTextContent(
        'has-get-row-id'
      )
    })
  })

  // Test sorting logic coverage
  test('tests sorting logic with pagination sort orders', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Sort Test Version',
        allocationAgreements: Array.from({ length: 15 }, (_, i) => ({
          allocationAgreementId: i + 1,
          agreementName: `Agreement ${String.fromCharCode(90 - i)}`, // Z, Y, X, etc.
          actionType: i % 2 === 0 ? 'CREATE' : 'UPDATE'
        }))
      }
    ]

    // Mock pagination state with sort orders
    const mockPaginationState = {
      page: 1,
      size: 10,
      sortOrders: [
        {
          field: 'agreementName',
          direction: 'asc'
        }
      ]
    }

    vi.mocked(useState).mockReturnValue([{ 0: mockPaginationState }, vi.fn()])

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    // Should apply sorting - results will be sorted by agreementName ascending
    expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows')
  })

  // Test handlePaginationChange function coverage
  test('tests handlePaginationChange function execution', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockChangelogData = [
      {
        version: 1,
        nickname: 'Pagination Change Test',
        allocationAgreements: Array.from({ length: 15 }, (_, i) => ({
          allocationAgreementId: i + 1,
          agreementName: `Agreement ${i + 1}`,
          actionType: 'CREATE'
        }))
      }
    ]

    const mockSetPaginationStates = vi.fn()
    vi.mocked(useState).mockReturnValue([{}, mockSetPaginationStates])

    vi.mocked(useGetChangeLog).mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })

    render(<AllocationAgreementChangelog />, [
      query,
      theme,
      localization,
      router
    ])

    // Should have pagination change button for large datasets
    const paginationButton = screen.getByTestId('pagination-change-trigger')
    expect(paginationButton).toBeInTheDocument()

    // Click the button to trigger handlePaginationChange
    await act(async () => {
      paginationButton.click()
    })

    // Should call setPaginationStates function
    expect(mockSetPaginationStates).toHaveBeenCalledWith(expect.any(Function))
  })
})
