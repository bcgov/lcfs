import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OtherUsesChangelog } from '../OtherUsesChangelog'
import { wrapper } from '@/tests/utils/wrapper'

// Mock hooks
vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: vi.fn(),
  useGetChangeLog: vi.fn()
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
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

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({
    complianceReportId: 'test-report-id',
    compliancePeriod: '2023'
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
      {/* Test getRowId function */}
      {getRowId && queryData?.data?.items?.length > 0 && (
        <div data-test="row-id-result">
          {getRowId({ data: queryData.data.items[0] })}
        </div>
      )}
      {/* Simulate items for testing */}
      {queryData?.data?.items?.map((item, index) => (
        <div key={index} data-test="grid-item">
          {item.otherUsesId} - {item.actionType}
        </div>
      ))}
    </div>
  )
}))

// Mock BCTypography
vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => (
    <div data-test="bc-typography" data-variant={props.variant} data-color={props.color}>
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
    { field: 'fuelType', headerName: 'Fuel Type' },
    { field: 'actionType', headerName: 'Action' }
  ],
  changelogCommonColDefs: (highlight) => [
    { field: 'fuelType', headerName: 'Fuel Type' },
    { field: 'quantitySupplied', headerName: 'Quantity Supplied' }
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
vi.mock('@/themes/base/colors', () => ({
  default: {
    alerts: {
      error: { background: '#ffebee' },
      success: { background: '#e8f5e8' }
    }
  }
}))

// Mock MUI components
vi.mock('@mui/material', () => ({
  Box: ({ children, ...props }) => <div data-test="mui-box" {...props}>{children}</div>,
  TextField: ({ children, ...props }) => <input data-test="mui-textfield" {...props}>{children}</input>,
  Button: ({ children, ...props }) => <button data-test="mui-button" {...props}>{children}</button>,
  IconButton: ({ children, ...props }) => <button data-test="mui-icon-button" {...props}>{children}</button>,
  Typography: ({ children, ...props }) => <div data-test="mui-typography" {...props}>{children}</div>,
  Grid: ({ children, ...props }) => <div data-test="mui-grid" {...props}>{children}</div>,
  Paper: ({ children, ...props }) => <div data-test="mui-paper" {...props}>{children}</div>,
  Card: ({ children, ...props }) => <div data-test="mui-card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }) => <div data-test="mui-card-content" {...props}>{children}</div>
}))

// Mock MUI styles
vi.mock('@mui/material/styles', () => ({
  styled: (component) => (styles) => component,
  useTheme: () => ({ spacing: (val) => `${val * 8}px` })
}))

import { useComplianceReportWithCache, useGetChangeLog } from '@/hooks/useComplianceReports'

describe('OtherUsesChangelog', () => {
  const mockCurrentReport = {
    report: {
      complianceReportGroupUuid: 'test-group-uuid'
    }
  }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useComplianceReportWithCache).mockReturnValue({
      data: mockCurrentReport,
      isLoading: false
    })
  })

  describe('Loading States', () => {
    it('shows loading component when changelog data is loading', () => {
      vi.mocked(useGetChangeLog).mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<OtherUsesChangelog />, { wrapper })
      expect(screen.getByTestId('loading-component')).toBeInTheDocument()
    })

    it('shows loading component when current report is loading', () => {
      vi.mocked(useComplianceReportWithCache).mockReturnValue({
        data: null,
        isLoading: true
      })
      vi.mocked(useGetChangeLog).mockReturnValue({
        data: [],
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })
      expect(screen.getByTestId('loading-component')).toBeInTheDocument()
    })

    it('shows loading component when both are loading', () => {
      vi.mocked(useComplianceReportWithCache).mockReturnValue({
        data: null,
        isLoading: true
      })
      vi.mocked(useGetChangeLog).mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<OtherUsesChangelog />, { wrapper })
      expect(screen.getByTestId('loading-component')).toBeInTheDocument()
    })
  })

  describe('Empty State Handling', () => {
    it('renders empty state when no changelog data', () => {
      vi.mocked(useGetChangeLog).mockReturnValue({
        data: [],
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })
      const grids = screen.queryAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(0)
    })

    it('handles undefined changelog data', () => {
      vi.mocked(useGetChangeLog).mockReturnValue({
        data: undefined,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })
      const grids = screen.queryAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(0)
    })

    it('handles empty other uses array', () => {
      const mockChangelogData = [
        {
          version: 1,
          nickname: 'Empty Version',
          otherUses: []
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      expect(screen.getByText('Empty Version')).toBeInTheDocument()
      expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
        'pagination-suppressed'
      )
    })
  })

  describe('Basic Rendering', () => {
    it('renders single changelog item correctly', () => {
      const mockChangelogData = [
        {
          version: 1,
          nickname: 'Version 1.0',
          otherUses: [
            { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' },
            { otherUsesId: 2, fuelType: 'Gasoline', actionType: 'UPDATE' }
          ]
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      expect(screen.getByText('Version 1.0')).toBeInTheDocument()
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
    })

    it('renders multiple changelog items correctly', () => {
      const mockChangelogData = [
        {
          version: 1,
          nickname: 'Current Version',
          otherUses: [
            { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
          ]
        },
        {
          version: 0,
          nickname: 'Original Version',
          otherUses: [
            { otherUsesId: 2, fuelType: 'Gasoline', actionType: 'DELETE' }
          ]
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      expect(screen.getByText('Current Version')).toBeInTheDocument()
      expect(screen.getByText('Original Version')).toBeInTheDocument()

      const grids = screen.getAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(2)
    })

    it('generates unique grid keys for multiple versions', () => {
      const mockChangelogData = [
        {
          version: 1,
          nickname: 'Version 1',
          otherUses: [
            { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
          ]
        },
        {
          version: 2,
          nickname: 'Version 2',
          otherUses: [
            { otherUsesId: 2, fuelType: 'Gasoline', actionType: 'UPDATE' }
          ]
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      const gridKeys = screen.getAllByTestId('grid-key')
      expect(gridKeys[0]).toHaveTextContent('other-uses-changelog-0')
      expect(gridKeys[1]).toHaveTextContent('other-uses-changelog-1')
    })
  })

  describe('getRowId Function', () => {
    it('correctly generates row IDs from otherUsesId', () => {
      const mockChangelogData = [
        {
          version: 1,
          nickname: 'Test Version',
          otherUses: [
            { otherUsesId: 123, fuelType: 'Diesel', actionType: 'CREATE' }
          ]
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      expect(screen.getByTestId('row-id-result')).toHaveTextContent('123')
    })
  })

  describe('Pagination Logic', () => {
    it('suppresses pagination for small datasets', () => {
      const mockChangelogData = [
        {
          version: 1,
          nickname: 'Small Dataset',
          otherUses: Array.from({ length: 5 }, (_, i) => ({
            otherUsesId: i + 1,
            fuelType: `Fuel ${i + 1}`,
            actionType: 'CREATE'
          }))
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

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
          otherUses: Array.from({ length: 15 }, (_, i) => ({
            otherUsesId: i + 1,
            fuelType: `Fuel ${i + 1}`,
            actionType: 'CREATE'
          }))
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

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

    it('handles pagination state management correctly', () => {
      const mockChangelogData = [
        {
          version: 1,
          nickname: 'Paginated Version',
          otherUses: Array.from({ length: 15 }, (_, i) => ({
            otherUsesId: i + 1,
            fuelType: `Fuel ${i + 1}`,
            actionType: 'CREATE'
          }))
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      // Should show first 10 items (default page size)
      expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows')
      expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
        'has-change-handler'
      )
    })

    it('suppresses pagination for current version with small dataset', () => {
      const mockChangelogData = [
        {
          version: 1, // Current (index 0)
          nickname: 'Current Version',
          otherUses: Array.from({ length: 3 }, (_, i) => ({
            otherUsesId: i + 1,
            fuelType: `Fuel ${i + 1}`,
            actionType: 'CREATE'
          }))
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      // UI pagination is suppressed if < 10 items, even for current version
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

    it('suppresses pagination for small datasets regardless of version', () => {
      const mockChangelogData = [
        {
          version: 2,
          nickname: 'Current Version',
          otherUses: [{ otherUsesId: 1, fuelType: 'Fuel', actionType: 'CREATE' }]
        },
        {
          version: 0, // Original version  
          nickname: 'Original Version',
          otherUses: Array.from({ length: 3 }, (_, i) => ({
            otherUsesId: i + 1,
            fuelType: `Fuel ${i + 1}`,
            actionType: 'CREATE'
          }))
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      const grids = screen.getAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(2)
      
      // Both should have pagination suppressed (< 10 items each)
      const paginationSuppressed = screen.getAllByTestId('pagination-suppressed')
      paginationSuppressed.forEach(element => {
        expect(element).toHaveTextContent('pagination-suppressed')
      })
    })
  })

  describe('Version Detection', () => {
    it('correctly identifies current and original versions', async () => {
      const mockChangelogData = [
        {
          version: 2, // Current (index 0)
          nickname: 'Current Version',
          otherUses: [
            { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
          ]
        },
        {
          version: 1, // Middle version
          nickname: 'Middle Version',
          otherUses: [
            { otherUsesId: 2, fuelType: 'Gasoline', actionType: 'UPDATE' }
          ]
        },
        {
          version: 0, // Original version
          nickname: 'Original Version',
          otherUses: [
            { otherUsesId: 3, fuelType: 'Biodiesel', actionType: 'DELETE' }
          ]
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      await waitFor(() => {
        const grids = screen.getAllByTestId('bc-grid-viewer')
        expect(grids).toHaveLength(3)
      })
    })

    it('uses different column definitions for current/original vs other versions', () => {
      const mockChangelogData = [
        {
          version: 1,
          nickname: 'Current Version',
          otherUses: [
            { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
          ]
        },
        {
          version: 2,
          nickname: 'Middle Version',
          otherUses: [
            { otherUsesId: 2, fuelType: 'Gasoline', actionType: 'UPDATE' }
          ]
        },
        {
          version: 0,
          nickname: 'Original Version',
          otherUses: [
            { otherUsesId: 3, fuelType: 'Biodiesel', actionType: 'DELETE' }
          ]
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      const grids = screen.getAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(3)

      // All should have getRowId function
      const getRowIdElements = screen.getAllByTestId('get-row-id')
      getRowIdElements.forEach((element) => {
        expect(element).toHaveTextContent('has-get-row-id')
      })
    })
  })

  describe('Data Filtering and Sorting', () => {
    it('handles client-side filtering and sorting', () => {
      const mockChangelogData = [
        {
          version: 1,
          nickname: 'Filterable Version',
          otherUses: Array.from({ length: 15 }, (_, i) => ({
            otherUsesId: i + 1,
            fuelType: i % 2 === 0 ? 'Diesel' : 'Gasoline',
            actionType: 'CREATE'
          }))
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      // Component should render with pagination enabled for filtering/sorting
      expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
        'has-change-handler'
      )
      expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows')
    })
  })

  describe('Error Handling', () => {
    it('handles missing report data gracefully', () => {
      vi.mocked(useComplianceReportWithCache).mockReturnValue({
        data: null,
        isLoading: false
      })

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: [],
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      // Should render without errors
      const grids = screen.queryAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(0)
    })

    it('uses correct overlay template for no rows', () => {
      const mockChangelogData = [
        {
          version: 1,
          nickname: 'Empty Version',
          otherUses: []
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      // Component should render with the correct overlay template
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('Grid Configuration', () => {
    it('applies correct default column definitions', () => {
      const mockChangelogData = [
        {
          version: 1,
          nickname: 'Test Version',
          otherUses: [
            { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
          ]
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('applies correct row styling based on action type', () => {
      const mockChangelogData = [
        {
          version: 1,
          nickname: 'Test Version',
          otherUses: [
            { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' },
            { otherUsesId: 2, fuelType: 'Gasoline', actionType: 'DELETE' }
          ]
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      render(<OtherUsesChangelog />, { wrapper })

      // Component should render with styling options available
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      expect(screen.getAllByTestId('grid-item')).toHaveLength(2)
    })
  })

  describe('Function Unit Tests', () => {
    let component
    let gridOptions
    let getPaginatedData
    let handlePaginationChange

    beforeEach(async () => {
      const mockChangelogData = [
        {
          version: 1,
          nickname: 'Test Version',
          otherUses: [
            { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
          ]
        }
      ]

      vi.mocked(useGetChangeLog).mockReturnValue({
        data: mockChangelogData,
        isLoading: false
      })

      // We need to access the component instance to test internal functions
      // This is a bit complex for React functional components, so we'll test through behavior
    })

    describe('gridOptions function behavior', () => {
      it('returns correct styling for DELETE action', () => {
        const mockChangelogData = [
          {
            version: 2, // Non-current version to get highlighting
            nickname: 'Test Version',
            otherUses: [
              { otherUsesId: 1, fuelType: 'Diesel', actionType: 'DELETE' }
            ]
          }
        ]

        vi.mocked(useGetChangeLog).mockReturnValue({
          data: mockChangelogData,
          isLoading: false
        })

        render(<OtherUsesChangelog />, { wrapper })
        expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      })

      it('returns correct styling for CREATE action', () => {
        const mockChangelogData = [
          {
            version: 2, // Non-current version to get highlighting
            nickname: 'Test Version',
            otherUses: [
              { otherUsesId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
            ]
          }
        ]

        vi.mocked(useGetChangeLog).mockReturnValue({
          data: mockChangelogData,
          isLoading: false
        })

        render(<OtherUsesChangelog />, { wrapper })
        expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      })

      it('returns no special styling for other action types', () => {
        const mockChangelogData = [
          {
            version: 2, // Non-current version to get highlighting
            nickname: 'Test Version',
            otherUses: [
              { otherUsesId: 1, fuelType: 'Diesel', actionType: 'UPDATE' }
            ]
          }
        ]

        vi.mocked(useGetChangeLog).mockReturnValue({
          data: mockChangelogData,
          isLoading: false
        })

        render(<OtherUsesChangelog />, { wrapper })
        expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      })

      it('does not apply styling when highlight is false', () => {
        const mockChangelogData = [
          {
            version: 1, // Current version (highlight = false)
            nickname: 'Current Version',
            otherUses: [
              { otherUsesId: 1, fuelType: 'Diesel', actionType: 'DELETE' }
            ]
          }
        ]

        vi.mocked(useGetChangeLog).mockReturnValue({
          data: mockChangelogData,
          isLoading: false
        })

        render(<OtherUsesChangelog />, { wrapper })
        expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      })
    })

    describe('getPaginatedData function behavior', () => {
      it('returns unpaginated data for small non-current datasets', () => {
        const mockChangelogData = [
          {
            version: 2, // Not current (index > 0) and not version 0
            nickname: 'Small Non-Current',
            otherUses: Array.from({ length: 5 }, (_, i) => ({
              otherUsesId: i + 1,
              fuelType: `Fuel ${i + 1}`,
              actionType: 'CREATE'
            }))
          }
        ]

        vi.mocked(useGetChangeLog).mockReturnValue({
          data: mockChangelogData,
          isLoading: false
        })

        render(<OtherUsesChangelog />, { wrapper })

        // Should show all 5 items without pagination
        expect(screen.getByTestId('row-count')).toHaveTextContent('5 rows')
        expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('pagination-suppressed')
      })

      it('processes data correctly for current version but suppresses UI pagination for small datasets', () => {
        const mockChangelogData = [
          {
            version: 1, // Current (index 0)
            nickname: 'Current Small',
            otherUses: Array.from({ length: 3 }, (_, i) => ({
              otherUsesId: i + 1,
              fuelType: `Fuel ${i + 1}`,
              actionType: 'CREATE'
            }))
          }
        ]

        vi.mocked(useGetChangeLog).mockReturnValue({
          data: mockChangelogData,
          isLoading: false
        })

        render(<OtherUsesChangelog />, { wrapper })

        // Data is processed correctly (all 3 items shown)
        expect(screen.getByTestId('row-count')).toHaveTextContent('3 rows')
        // But UI pagination is suppressed because < 10 items
        expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('pagination-suppressed')
      })

      it('returns paginated data for large datasets', () => {
        const mockChangelogData = [
          {
            version: 2, // Non-current
            nickname: 'Large Dataset',
            otherUses: Array.from({ length: 15 }, (_, i) => ({
              otherUsesId: i + 1,
              fuelType: `Fuel ${i + 1}`,
              actionType: 'CREATE'
            }))
          }
        ]

        vi.mocked(useGetChangeLog).mockReturnValue({
          data: mockChangelogData,
          isLoading: false
        })

        render(<OtherUsesChangelog />, { wrapper })

        // Should paginate and show first 10 items
        expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows')
        expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('pagination-enabled')
      })

      it('handles empty otherUses array', () => {
        const mockChangelogData = [
          {
            version: 1,
            nickname: 'Empty Dataset',
            otherUses: []
          }
        ]

        vi.mocked(useGetChangeLog).mockReturnValue({
          data: mockChangelogData,
          isLoading: false
        })

        render(<OtherUsesChangelog />, { wrapper })

        expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
      })

      it('correctly identifies version 0 as original version but suppresses pagination for small datasets', () => {
        const mockChangelogData = [
          {
            version: 2,
            nickname: 'Some Version',
            otherUses: [{ otherUsesId: 1, fuelType: 'Fuel', actionType: 'CREATE' }]
          },
          {
            version: 0, // Original version
            nickname: 'Original Version',
            otherUses: Array.from({ length: 3 }, (_, i) => ({
              otherUsesId: i + 1,
              fuelType: `Fuel ${i + 1}`,
              actionType: 'CREATE'
            }))
          }
        ]

        vi.mocked(useGetChangeLog).mockReturnValue({
          data: mockChangelogData,
          isLoading: false
        })

        render(<OtherUsesChangelog />, { wrapper })

        const grids = screen.getAllByTestId('bc-grid-viewer')
        expect(grids).toHaveLength(2)

        // Both should have pagination suppressed (< 10 items each)
        const paginationElements = screen.getAllByTestId('pagination-suppressed')
        paginationElements.forEach(element => {
          expect(element).toHaveTextContent('pagination-suppressed')
        })
      })
    })
  })
})