import 'react'
import { screen, fireEvent } from '@testing-library/react'
import { describe, expect, beforeEach, vi } from 'vite-plus/test'
import { NotionalTransferSummary } from '../NotionalTransferSummary'
import { test } from '@/tests/utils/fixtures'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import type { ReactNode, HTMLAttributes, PropsWithChildren } from 'react'
import type { RenderOptions, RenderResult } from '@testing-library/react'
import type { BCPaginationOptions } from '@/components/BCDataGrid/types'

type NotionalTransferRow = {
  notionalTransferId: number | string
  isCanadaProduced?: boolean
}
type SummaryViewerProps = {
  gridKey?: string | null
  columnDefs?: unknown[]
  queryData?: { data?: Record<string, unknown> }
  dataKey?: string
  defaultColDef?: { cellRenderer?: unknown }
  suppressPagination?: boolean
  onPaginationChange?: (pagination: BCPaginationOptions) => void
  getRowId?: (params: { data: NotionalTransferRow }) => string
  paginationOptions?: unknown
}
type FixtureRender = (
  ui: ReactNode,
  options?: Omit<RenderOptions, 'wrapper'>
) => RenderResult
type ContainerProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>
type StoreState = {
  currentReport?: { report?: { reportingFrequency?: string } } | null
}

let render: FixtureRender
const it = (name: string, fn: () => unknown) =>
  test(name, ({ render: fixtureRender, theme }) => {
    render = (ui, options) => fixtureRender(ui, [theme], options)
    return fn()
  })

// Mock BCGridViewer
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: ({
    gridKey,
    columnDefs,
    queryData,
    dataKey,
    defaultColDef,
    suppressPagination,
    onPaginationChange,
    getRowId,
    ...props
  }: SummaryViewerProps) => {
    delete props.paginationOptions
    const rows = dataKey && queryData?.data?.[dataKey]
    const rowCount = Array.isArray(rows) ? rows.length : 0
    const productionValues = Array.isArray(rows)
      ? rows.map((row) =>
          typeof row === 'object' && row !== null && 'isCanadaProduced' in row
            ? String(row.isCanadaProduced)
            : ''
        )
      : []
    return (
      <div data-test="bc-grid-viewer">
        <div data-test="grid-key">{gridKey}</div>
        <div data-test="data-key">{dataKey}</div>
        <div data-test="row-count">{rowCount} rows</div>
        <div data-test="row-values">{productionValues.join(',')}</div>
        <div data-test="pagination-suppressed">
          {String(suppressPagination)}
        </div>
        <div data-test="has-cell-renderer">
          {defaultColDef?.cellRenderer ? 'true' : 'false'}
        </div>
        <div data-test="column-defs-length">{columnDefs?.length || 0}</div>
        <button
          data-test="pagination-change-button"
          onClick={() => onPaginationChange?.({ page: 2, size: 20 })}
        >
          Change Pagination
        </button>
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
        <button
          data-test="get-row-id-button"
          onClick={() => {
            const result = getRowId?.({ data: { notionalTransferId: 123 } })
            const event = new CustomEvent('getRowIdResult', { detail: result })
            document.dispatchEvent(event)
          }}
        >
          Test GetRowId
        </button>
      </div>
    )
  }
}))

// Mock other components
vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }: ContainerProps) => (
    <div data-test="bc-box" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@mui/material/Grid2', () => ({
  default: ({ children, ...props }: ContainerProps) => (
    <div data-test="grid2" {...props}>
      {children}
    </div>
  )
}))

// Mock the schema
vi.mock('@/views/NotionalTransfers/_schema', () => ({
  notionalTransferSummaryColDefs: vi.fn((isEarlyIssuance: boolean) => [
    { field: 'legalName', headerName: 'Legal Name' },
    { field: 'quantity', headerName: 'Quantity' },
    ...(isEarlyIssuance
      ? [{ field: 'earlyIssuanceField', headerName: 'Early Issuance' }]
      : [])
  ])
}))

// Mock cell renderers
vi.mock('@/utils/grid/cellRenderers', () => ({
  LinkRenderer: () => <div data-test="link-renderer">Link Renderer</div>
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

vi.mock('@/constants/common', () => ({
  REPORT_SCHEDULES: {
    QUARTERLY: 'QUARTERLY',
    ANNUAL: 'ANNUAL'
  }
}))

// Mock the store - default implementation
const mockStore = vi.fn<() => StoreState>(() => ({
  currentReport: {
    report: {
      reportingFrequency: 'ANNUAL'
    }
  }
}))

vi.mock('@/stores/useComplianceReportStore', () => ({
  default: () => mockStore()
}))

describe('NotionalTransferSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.mockReturnValue({
      currentReport: {
        report: {
          reportingFrequency: 'ANNUAL'
        }
      }
    })
  })

  describe('boolean sorting', () => {
    it('sorts boolean fields consistently across pages', () => {
      const notionalTransfers = Array.from({ length: 12 }, (_, index) => ({
        notionalTransferId: index + 1,
        isCanadaProduced: index < 6
      }))

      render(
        <NotionalTransferSummary
          data={{ notionalTransfers }}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      fireEvent.click(screen.getByTestId('sort-booleans-button'))
      expect(screen.getByTestId('row-values')).toHaveTextContent(
        'false,false,false,false,false,false,true,true,true,true'
      )

      fireEvent.click(screen.getByTestId('next-page-button'))
      expect(screen.getByTestId('row-values')).toHaveTextContent('true,true')
    })
  })

  describe('Basic Rendering', () => {
    it('renders the component with basic props', () => {
      render(
        <NotionalTransferSummary
          data={{ notionalTransfers: [] }}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('grid2')).toBeInTheDocument()
      expect(screen.getByTestId('bc-box')).toBeInTheDocument()
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('passes correct grid configuration props', () => {
      render(
        <NotionalTransferSummary
          data={{ notionalTransfers: [] }}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('grid-key')).toHaveTextContent(
        'notional-transfers'
      )
      expect(screen.getByTestId('data-key')).toHaveTextContent(
        'notionalTransfers'
      )
    })
  })

  describe('boolean sorting', () => {
    it('sorts boolean fields consistently across pages', () => {
      const notionalTransfers = Array.from({ length: 12 }, (_, index) => ({
        notionalTransferId: index + 1,
        isCanadaProduced: index < 6
      }))

      render(
        <NotionalTransferSummary
          data={{ notionalTransfers }}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      fireEvent.click(screen.getByTestId('sort-booleans-button'))
      expect(screen.getByTestId('row-values')).toHaveTextContent(
        'false,false,false,false,false,false,true,true,true,true'
      )

      fireEvent.click(screen.getByTestId('next-page-button'))
      expect(screen.getByTestId('row-values')).toHaveTextContent('true,true')
    })
  })

  describe('Data Handling - paginatedData useMemo', () => {
    it('handles null data gracefully', () => {
      render(
        <NotionalTransferSummary
          data={null}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    })

    it('handles undefined data gracefully', () => {
      render(
        <NotionalTransferSummary
          data={undefined}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    })

    it('handles missing notionalTransfers property', () => {
      render(
        <NotionalTransferSummary
          data={{}}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
    })

    it('filters out DELETE actionType items', () => {
      const mockData = {
        notionalTransfers: [
          { notionalTransferId: 1, legalName: 'Org A', actionType: 'CREATE' },
          { notionalTransferId: 2, legalName: 'Org B', actionType: 'DELETE' },
          { notionalTransferId: 3, legalName: 'Org C', actionType: 'UPDATE' }
        ]
      }

      render(
        <NotionalTransferSummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('row-count')).toHaveTextContent('2 rows')
    })

    it('processes data with various actionTypes correctly', () => {
      const mockData = {
        notionalTransfers: [
          { notionalTransferId: 1, legalName: 'Org A', actionType: 'CREATE' },
          { notionalTransferId: 2, legalName: 'Org B', actionType: 'UPDATE' },
          { notionalTransferId: 3, legalName: 'Org C', actionType: 'EDIT' },
          { notionalTransferId: 4, legalName: 'Org D', actionType: null }
        ]
      }

      render(
        <NotionalTransferSummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('row-count')).toHaveTextContent('4 rows')
    })
  })

  describe('getRowId Function', () => {
    it('returns correct row id', async () => {
      render(
        <NotionalTransferSummary
          data={{ notionalTransfers: [] }}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      const promise = new Promise((resolve) => {
        document.addEventListener('getRowIdResult', (event) => {
          if (event instanceof CustomEvent) resolve(event.detail)
        })
      })

      fireEvent.click(screen.getByTestId('get-row-id-button'))

      const result = await promise
      expect(result).toBe('123')
    })
  })

  describe('defaultColDef useMemo', () => {
    it('includes LinkRenderer when status is DRAFT', () => {
      render(
        <NotionalTransferSummary
          data={{ notionalTransfers: [] }}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('has-cell-renderer')).toHaveTextContent('true')
    })

    it('excludes LinkRenderer when status is not DRAFT', () => {
      render(
        <NotionalTransferSummary
          data={{ notionalTransfers: [] }}
          status={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
        />
      )

      expect(screen.getByTestId('has-cell-renderer')).toHaveTextContent('false')
    })

    it('excludes LinkRenderer when status is approved', () => {
      render(
        <NotionalTransferSummary
          data={{ notionalTransfers: [] }}
          status="Approved"
        />
      )

      expect(screen.getByTestId('has-cell-renderer')).toHaveTextContent('false')
    })
  })

  describe('isEarlyIssuance Logic', () => {
    it('identifies quarterly reporting as early issuance', () => {
      mockStore.mockReturnValue({
        currentReport: {
          report: {
            reportingFrequency: 'QUARTERLY'
          }
        }
      })

      render(
        <NotionalTransferSummary
          data={{ notionalTransfers: [] }}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('column-defs-length')).toHaveTextContent('3')
    })

    it('identifies annual reporting as not early issuance', () => {
      mockStore.mockReturnValue({
        currentReport: {
          report: {
            reportingFrequency: 'ANNUAL'
          }
        }
      })

      render(
        <NotionalTransferSummary
          data={{ notionalTransfers: [] }}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('column-defs-length')).toHaveTextContent('2')
    })

    it('handles null currentReport gracefully', () => {
      mockStore.mockReturnValue({
        currentReport: null
      })

      render(
        <NotionalTransferSummary
          data={{ notionalTransfers: [] }}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('column-defs-length')).toHaveTextContent('2')
    })

    it('handles undefined currentReport gracefully', () => {
      mockStore.mockReturnValue({
        currentReport: undefined
      })

      render(
        <NotionalTransferSummary
          data={{ notionalTransfers: [] }}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('column-defs-length')).toHaveTextContent('2')
    })

    it('handles missing report property gracefully', () => {
      mockStore.mockReturnValue({
        currentReport: {}
      })

      render(
        <NotionalTransferSummary
          data={{ notionalTransfers: [] }}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('column-defs-length')).toHaveTextContent('2')
    })
  })

  describe('Pagination Logic', () => {
    it('suppresses pagination when data length is 10 or less', () => {
      const mockData = {
        notionalTransfers: Array.from({ length: 10 }, (_, i) => ({
          notionalTransferId: i + 1,
          legalName: `Org ${i + 1}`,
          actionType: 'CREATE'
        }))
      }

      render(
        <NotionalTransferSummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
        'true'
      )
    })

    it('enables pagination when data length is greater than 10', () => {
      const mockData = {
        notionalTransfers: Array.from({ length: 11 }, (_, i) => ({
          notionalTransferId: i + 1,
          legalName: `Org ${i + 1}`,
          actionType: 'CREATE'
        }))
      }

      render(
        <NotionalTransferSummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
        'false'
      )
    })

    it('handles onPaginationChange callback correctly', () => {
      const mockData = {
        notionalTransfers: [
          { notionalTransferId: 1, legalName: 'Org A', actionType: 'CREATE' }
        ]
      }

      render(
        <NotionalTransferSummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      fireEvent.click(screen.getByTestId('pagination-change-button'))
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles empty notionalTransfers array', () => {
      render(
        <NotionalTransferSummary
          data={{ notionalTransfers: [] }}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('row-count')).toHaveTextContent('0 rows')
      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
        'true'
      )
    })

    it('handles large dataset with pagination', () => {
      const mockData = {
        notionalTransfers: Array.from({ length: 100 }, (_, i) => ({
          notionalTransferId: i + 1,
          legalName: `Organization ${i + 1}`,
          actionType: 'CREATE'
        }))
      }

      render(
        <NotionalTransferSummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      // With client-side pagination, should show first page (10 items) of 100 total
      expect(screen.getByTestId('row-count')).toHaveTextContent('10 rows')
      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent(
        'false'
      )
    })

    it('handles mixed actionTypes including DELETE', () => {
      const mockData = {
        notionalTransfers: [
          { notionalTransferId: 1, actionType: 'CREATE' },
          { notionalTransferId: 2, actionType: 'DELETE' },
          { notionalTransferId: 3, actionType: 'UPDATE' },
          { notionalTransferId: 4, actionType: 'DELETE' },
          { notionalTransferId: 5, actionType: 'EDIT' }
        ]
      }

      render(
        <NotionalTransferSummary
          data={mockData}
          status={COMPLIANCE_REPORT_STATUSES.DRAFT}
        />
      )

      expect(screen.getByTestId('row-count')).toHaveTextContent('3 rows')
    })
  })
})
