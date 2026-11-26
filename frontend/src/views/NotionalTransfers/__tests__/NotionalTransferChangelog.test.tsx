import 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, beforeEach, vi } from 'vite-plus/test'
import { NotionalTransferChangelog } from '../NotionalTransferChangelog'
import { test } from '@/tests/utils/fixtures'
import type { ReactNode, HTMLAttributes, PropsWithChildren } from 'react'
import type { RenderOptions, RenderResult } from '@testing-library/react'
import type { BCPaginationOptions } from '@/components/BCDataGrid/types'

type HookResult = { data?: unknown; isLoading: boolean }
type NotionalTransferRow = {
  notionalTransferId: number | string
  actionType?: string
  isCanadaProduced?: boolean
}
type ChangelogViewerProps = {
  gridKey?: string | null
  columnDefs?: unknown[]
  queryData?: { data?: { items?: NotionalTransferRow[] } }
  getRowId?: (params: { data: NotionalTransferRow }) => string
  suppressPagination?: boolean
  gridOptions?: unknown
  paginationOptions?: unknown
  onPaginationChange?: (pagination: BCPaginationOptions) => void
}
type FixtureRender = (
  ui: ReactNode,
  options?: Omit<RenderOptions, 'wrapper'>
) => RenderResult
type ContainerProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>

const hookMocks = vi.hoisted(() => ({
  useComplianceReportWithCache: vi.fn<() => HookResult>(),
  useGetChangeLog: vi.fn<() => HookResult>()
}))
const { useComplianceReportWithCache, useGetChangeLog } = hookMocks

let render: FixtureRender
const it = (name: string, fn: () => unknown) =>
  test(name, ({ render: fixtureRender }) => {
    render = (ui, options) => fixtureRender(ui, [], options)
    return fn()
  })

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({
    complianceReportId: 'test-report-id',
    compliancePeriod: '2024'
  })
}))

// Mock compliance report hooks
vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: hookMocks.useComplianceReportWithCache,
  useGetChangeLog: hookMocks.useGetChangeLog
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
    paginationOptions,
    onPaginationChange
  }: ChangelogViewerProps) => {
    const items = queryData?.data?.items ?? []
    return (
      <div data-test="bc-grid-viewer">
        <div data-test="grid-key">{gridKey}</div>
        <div data-test="row-count">{items.length}</div>
        <div data-test="row-values">
          {items.map((item) => String(item.isCanadaProduced)).join(',')}
        </div>
        <div data-test="pagination-suppressed">
          {suppressPagination?.toString()}
        </div>
        <div data-test="has-pagination-options">
          {(!!paginationOptions).toString()}
        </div>
        <div data-test="has-pagination-change">
          {(!!onPaginationChange).toString()}
        </div>
        <div data-test="column-count">{columnDefs?.length || 0}</div>
        <div data-test="grid-options">{JSON.stringify(gridOptions || {})}</div>
        <button
          data-test="sort-booleans-button"
          onClick={() =>
            onPaginationChange?.({
              page: 1,
              size: 10,
              sortOrders: [{ field: 'isCanadaProduced', direction: 'asc' }]
            })
          }
        >
          Sort Booleans
        </button>
        <button
          data-test="next-page-button"
          onClick={() => onPaginationChange?.({ page: 2, size: 10 })}
        >
          Next Page
        </button>
        {items.map((item, index) => (
          <div key={index} data-test="grid-item">
            ID: {getRowId ? getRowId({ data: item }) : 'no-id'} -{' '}
            {item.actionType}
          </div>
        ))}
      </div>
    )
  }
}))

// Mock BCTypography
vi.mock('@/components/BCTypography', () => ({
  default: ({
    children,
    variant,
    color,
    component,
    ...props
  }: ContainerProps & {
    variant?: string
    color?: string
    component?: React.ElementType
  }) => {
    const Component = component || 'div'
    return (
      <Component
        data-test="bc-typography"
        data-variant={variant}
        data-color={color}
        {...props}
      >
        {children}
      </Component>
    )
  }
}))

// Mock Loading
vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading">Loading...</div>
}))

// Mock Material-UI components
vi.mock('@mui/material/Box', () => ({
  default: ({
    children,
    mb,
    ...props
  }: ContainerProps & { mb?: number | string }) => (
    <div data-test="mui-box" data-mb={mb} {...props}>
      {children}
    </div>
  )
}))

vi.mock('@mui/material/TextField', () => ({
  default: ({ children, ...props }: ContainerProps) => (
    <div data-test="text-field" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@mui/material/Button', () => ({
  default: ({ children, ...props }: ContainerProps) => (
    <div data-test="button" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@mui/material/Typography', () => ({
  default: ({ children, ...props }: ContainerProps) => (
    <div data-test="typography" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@mui/material/Paper', () => ({
  default: ({ children, ...props }: ContainerProps) => (
    <div data-test="paper" {...props}>
      {children}
    </div>
  )
}))

// Mock Material-UI styles
vi.mock('@mui/material/styles', () => ({
  styled: () => () =>
    function StyledMock({ children, ...props }: ContainerProps) {
      return (
        <div data-test="styled-component" {...props}>
          {children}
        </div>
      )
    },
  useTheme: () => ({
    spacing: (val: number) => val * 8,
    palette: {
      primary: { main: '#1976d2' },
      secondary: { main: '#dc004e' }
    }
  })
}))

// Mock schema
vi.mock('./_schema', () => ({
  changelogColDefs: () => [
    { field: 'notionalTransferId', headerName: 'ID' },
    { field: 'legalName', headerName: 'Legal Name' },
    { field: 'actionType', headerName: 'Action' },
    { field: 'quantity', headerName: 'Quantity' },
    { field: 'unitOfMeasure', headerName: 'Unit' }
  ],
  changelogCommonColDefs: () => [
    { field: 'notionalTransferId', headerName: 'ID' },
    { field: 'legalName', headerName: 'Legal Name' }
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

describe('NotionalTransferChangelog', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    useComplianceReportWithCache.mockReturnValue({
      data: {
        report: {
          complianceReportGroupUuid: 'test-group-uuid'
        }
      },
      isLoading: false
    })

    useGetChangeLog.mockReturnValue({
      data: [],
      isLoading: false
    })
  })

  describe('boolean sorting', () => {
    it('sorts boolean fields consistently across pages', () => {
      const notionalTransfers = Array.from({ length: 12 }, (_, index) => ({
        notionalTransferId: index + 1,
        isCanadaProduced: index < 6
      }))

      useGetChangeLog.mockReturnValue({
        data: [{ version: 0, nickname: 'Current', notionalTransfers }],
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      fireEvent.click(screen.getByTestId('sort-booleans-button'))
      expect(screen.getByTestId('row-values')).toHaveTextContent(
        'false,false,false,false,false,false,true,true,true,true'
      )

      fireEvent.click(screen.getByTestId('next-page-button'))
      expect(screen.getByTestId('row-values')).toHaveTextContent('true,true')
    })
  })

  describe('Loading states', () => {
    it('shows loading when changelogDataLoading is true', () => {
      useGetChangeLog.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<NotionalTransferChangelog />)
      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    it('shows loading when currentReportLoading is true', () => {
      useComplianceReportWithCache.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<NotionalTransferChangelog />)
      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })
  })

  describe('getRowId function', () => {
    it('converts notionalTransferId to string', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Test Version',
          notionalTransfers: [
            {
              notionalTransferId: 123,
              actionType: 'CREATE',
              legalName: 'Test Org'
            }
          ]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      expect(screen.getByTestId('grid-item')).toHaveTextContent(
        'ID: 123 - CREATE'
      )
    })
  })

  describe('gridOptions function', () => {
    it('applies DELETE action styling', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Test Version',
          notionalTransfers: [
            {
              notionalTransferId: 1,
              actionType: 'DELETE',
              legalName: 'Test Org'
            }
          ]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      const gridOptions = JSON.parse(
        screen.getByTestId('grid-options').textContent
      )
      expect(gridOptions.overlayNoRowsTemplate).toBe(
        'notionalTransfer:noNotionalTransfersFound'
      )
      expect(gridOptions.autoSizeStrategy.type).toBe('fitGridWidth')
      expect(gridOptions.enableCellTextSelection).toBe(true)
      expect(gridOptions.ensureDomOrder).toBe(true)
    })

    it('applies CREATE action styling', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Test Version',
          notionalTransfers: [
            {
              notionalTransferId: 1,
              actionType: 'CREATE',
              legalName: 'Test Org'
            }
          ]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)
      expect(screen.getByTestId('grid-item')).toHaveTextContent(
        'ID: 1 - CREATE'
      )
    })

    it('handles no styling for other action types', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Test Version',
          notionalTransfers: [
            {
              notionalTransferId: 1,
              actionType: 'UPDATE',
              legalName: 'Test Org'
            }
          ]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)
      expect(screen.getByTestId('grid-item')).toHaveTextContent(
        'ID: 1 - UPDATE'
      )
    })
  })

  describe('getPaginatedData function', () => {
    it('returns all data when pagination disabled (small dataset)', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Small Dataset',
          notionalTransfers: Array.from({ length: 5 }, (_, i) => ({
            notionalTransferId: i + 1,
            actionType: 'CREATE',
            legalName: `Org ${i + 1}`
          }))
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      expect(screen.getByTestId('row-count')).toHaveTextContent('5')
      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
        'true'
      )
    })

    it('applies pagination for large datasets', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Large Dataset',
          notionalTransfers: Array.from({ length: 15 }, (_, i) => ({
            notionalTransferId: i + 1,
            actionType: 'CREATE',
            legalName: `Org ${i + 1}`
          }))
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      expect(screen.getByTestId('row-count')).toHaveTextContent('10')
      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
        'false'
      )
      expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
        'true'
      )
      expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
        'true'
      )
    })

    it('suppresses pagination for current version with small dataset', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Current Version',
          notionalTransfers: Array.from({ length: 3 }, (_, i) => ({
            notionalTransferId: i + 1,
            actionType: 'CREATE',
            legalName: `Org ${i + 1}`
          }))
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      expect(screen.getByTestId('row-count')).toHaveTextContent('3')
      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
        'true'
      )
      expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
        'false'
      )
    })

    it('suppresses pagination for original version with small dataset', () => {
      const mockData = [
        {
          version: 0,
          nickname: 'Original Version',
          notionalTransfers: Array.from({ length: 3 }, (_, i) => ({
            notionalTransferId: i + 1,
            actionType: 'CREATE',
            legalName: `Org ${i + 1}`
          }))
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
        'true'
      )
      expect(screen.getByTestId('has-pagination-options')).toHaveTextContent(
        'false'
      )
    })
  })

  describe('handlePaginationChange function', () => {
    it('provides pagination handler for large datasets', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Test Version',
          notionalTransfers: Array.from({ length: 15 }, (_, i) => ({
            notionalTransferId: i + 1,
            actionType: 'CREATE',
            legalName: `Org ${i + 1}`
          }))
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
        'true'
      )
    })

    it('does not provide pagination handler for small datasets', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Small Dataset',
          notionalTransfers: Array.from({ length: 5 }, (_, i) => ({
            notionalTransferId: i + 1,
            actionType: 'CREATE',
            legalName: `Org ${i + 1}`
          }))
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      expect(screen.getByTestId('has-pagination-change')).toHaveTextContent(
        'false'
      )
    })
  })

  describe('Rendering logic', () => {
    it('renders empty state with no data', () => {
      useGetChangeLog.mockReturnValue({
        data: [],
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      const grids = screen.queryAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(0)
    })

    it('renders single changelog item', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Test Version',
          notionalTransfers: [
            {
              notionalTransferId: 1,
              actionType: 'CREATE',
              legalName: 'Test Org'
            }
          ]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      expect(screen.getByText('Test Version')).toBeInTheDocument()
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('row-count')).toHaveTextContent('1')
    })

    it('renders multiple changelog items', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Current Version',
          notionalTransfers: [
            { notionalTransferId: 1, actionType: 'CREATE', legalName: 'Org A' }
          ]
        },
        {
          version: 0,
          nickname: 'Original Version',
          notionalTransfers: [
            { notionalTransferId: 2, actionType: 'DELETE', legalName: 'Org B' }
          ]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      expect(screen.getByText('Current Version')).toBeInTheDocument()
      expect(screen.getByText('Original Version')).toBeInTheDocument()

      const grids = screen.getAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(2)
    })

    it('uses column definitions for different version types', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Current Version',
          notionalTransfers: [
            { notionalTransferId: 1, actionType: 'CREATE', legalName: 'Org A' }
          ]
        },
        {
          version: 2,
          nickname: 'Middle Version',
          notionalTransfers: [
            { notionalTransferId: 2, actionType: 'UPDATE', legalName: 'Org B' }
          ]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      // Verify that both grids have column definitions
      const grids = screen.getAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(2)

      const columnCounts = screen.getAllByTestId('column-count')
      expect(columnCounts).toHaveLength(2)
      // Both should have positive column counts indicating column definitions are passed
      expect(parseInt(columnCounts[0].textContent)).toBeGreaterThan(0)
      expect(parseInt(columnCounts[1].textContent)).toBeGreaterThan(0)
    })

    it('generates unique grid keys', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Version 1',
          notionalTransfers: [
            { notionalTransferId: 1, actionType: 'CREATE', legalName: 'Org A' }
          ]
        },
        {
          version: 2,
          nickname: 'Version 2',
          notionalTransfers: [
            { notionalTransferId: 2, actionType: 'UPDATE', legalName: 'Org B' }
          ]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      const gridKeys = screen.getAllByTestId('grid-key')
      expect(gridKeys[0]).toHaveTextContent('notional-transfers-changelog-0')
      expect(gridKeys[1]).toHaveTextContent('notional-transfers-changelog-1')
    })

    it('handles empty notionalTransfers array', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Empty Version',
          notionalTransfers: []
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      expect(screen.getByText('Empty Version')).toBeInTheDocument()
      expect(screen.getByTestId('row-count')).toHaveTextContent('0')
    })
  })

  describe('Hook integration', () => {
    it('calls hooks with correct parameters', () => {
      render(<NotionalTransferChangelog />)

      expect(useComplianceReportWithCache).toHaveBeenCalledWith(
        'test-report-id'
      )
      expect(useGetChangeLog).toHaveBeenCalledWith({
        complianceReportGroupUuid: 'test-group-uuid',
        dataType: 'notional-transfers'
      })
    })

    it('handles missing currentReport gracefully', () => {
      useComplianceReportWithCache.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      expect(useGetChangeLog).toHaveBeenCalledWith({
        complianceReportGroupUuid: undefined,
        dataType: 'notional-transfers'
      })
    })
  })

  describe('Component structure', () => {
    it('renders proper Box structure', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Test Version',
          notionalTransfers: [
            {
              notionalTransferId: 1,
              actionType: 'CREATE',
              legalName: 'Test Org'
            }
          ]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      const boxes = screen.getAllByTestId('mui-box')
      expect(boxes.length).toBeGreaterThan(0)

      // Check for the main container box and item boxes
      const itemBox = boxes.find((box) => box.getAttribute('data-mb') === '4')
      expect(itemBox).toBeInTheDocument()
    })

    it('renders BCTypography with correct props', () => {
      const mockData = [
        {
          version: 1,
          nickname: 'Test Version Title',
          notionalTransfers: [
            {
              notionalTransferId: 1,
              actionType: 'CREATE',
              legalName: 'Test Org'
            }
          ]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />)

      const typography = screen.getByTestId('bc-typography')
      expect(typography).toHaveAttribute('data-variant', 'h6')
      expect(typography).toHaveAttribute('data-color', 'primary')
      expect(typography).toHaveTextContent('Test Version Title')
    })
  })
})
