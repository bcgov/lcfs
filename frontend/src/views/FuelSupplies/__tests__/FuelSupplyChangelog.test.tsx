import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { render, screen, fireEvent } from '@testing-library/react'
import { FuelSupplyChangelog } from '../FuelSupplyChangelog'

// Import the mocked modules for configuration
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { changelogColDefs, changelogCommonColDefs } from '../_schema'
import { getFuelSupplyChangelogRowStyle, getFuelSupplyRowId } from '../_utils'

type HookResult = { data?: unknown; isLoading: boolean }
type MockProps = {
  gridKey?: string | null
  onPaginationChange?: (pagination: { page: number; size: number }) => void
}
type GridViewerRows = Array<{ fuelSupplyId: number | string }>
type PaginationSnapshot = { page: number; size: number; total: number }
type QuerySnapshot = { items: GridViewerRows; pagination?: PaginationSnapshot }
const testMocks = vi.hoisted(() => ({
  useComplianceReportWithCache: vi.fn<(...args: unknown[]) => HookResult>(),
  useGetChangeLog: vi.fn<(...args: unknown[]) => HookResult>(),
  useParams: vi.fn<() => Record<string, string>>(),
  useTranslation: vi.fn<() => { t: (key: string) => string }>(),
  useFuelSupplyOptions: vi.fn<(...args: unknown[]) => HookResult>()
}))

// Mock all external dependencies
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: vi.fn(({ gridKey, onPaginationChange }: MockProps) => {
    const handlePaginationTest = () => {
      if (onPaginationChange && typeof onPaginationChange === 'function') {
        onPaginationChange({ page: 2, size: 10 })
      }
    }

    return (
      <div data-test={`bc-grid-viewer-${gridKey}`}>
        <button onClick={handlePaginationTest} data-test="pagination-trigger">
          Test Pagination
        </button>
        Grid Content
      </div>
    )
  })
}))

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: vi.fn(({ children, ...props }) => (
    <div data-test="bc-typography" {...props}>
      {children}
    </div>
  ))
}))

vi.mock('@/components/Loading', () => ({
  __esModule: true,
  default: vi.fn(() => <div data-test="loading">Loading...</div>)
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: testMocks.useComplianceReportWithCache,
  useGetChangeLog: testMocks.useGetChangeLog
}))

vi.mock('@/constants/schedules', () => ({
  defaultInitialPagination: {
    page: 1,
    size: 10,
    filters: [],
    sortOrders: []
  }
}))

vi.mock('@/themes/base/colors', () => ({
  __esModule: true,
  default: {
    alerts: {
      error: { background: '#ffebee' },
      success: { background: '#e8f5e8' }
    }
  }
}))

vi.mock('react-router-dom', () => ({
  useParams: testMocks.useParams
}))

vi.mock('react-i18next', () => ({
  useTranslation: testMocks.useTranslation
}))

vi.mock('@/hooks/useFuelSupply', () => ({
  useFuelSupplyOptions: testMocks.useFuelSupplyOptions
}))

vi.mock('../_schema', () => ({
  changelogColDefs: vi.fn(() => [{ field: 'actionType' }]),
  changelogCommonColDefs: vi.fn((showActions) => [
    { field: 'common', showActions }
  ])
}))

describe('FuelSupplyChangelog', () => {
  const mockComplianceReportId = 'test-report-id'
  const mockCompliancePeriod = '2024'

  const mockComplianceReport = {
    report: {
      complianceReportGroupUuid: 'test-group-uuid'
    }
  }

  const mockChangelogData = [
    {
      nickname: 'Current Version',
      version: 1,
      fuelSupplies: Array.from({ length: 15 }, (_, i) => ({
        fuelSupplyId: i + 1,
        actionType: i % 3 === 0 ? 'CREATE' : i % 3 === 1 ? 'DELETE' : null,
        field1: `value${i + 1}`
      }))
    },
    {
      nickname: 'Original Version',
      version: 0,
      fuelSupplies: [
        { fuelSupplyId: 100, field3: 'value3' },
        { fuelSupplyId: 101, field4: 'value4' }
      ]
    },
    {
      nickname: 'Small Version',
      version: 2,
      fuelSupplies: [
        { fuelSupplyId: 200, actionType: 'CREATE', field5: 'value5' }
      ]
    }
  ]

  const mockTranslate = vi.fn((key: string) => key)

  const isGridViewerRows = (value: unknown): value is GridViewerRows =>
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'fuelSupplyId' in item &&
        (typeof item.fuelSupplyId === 'string' ||
          typeof item.fuelSupplyId === 'number')
    )

  const isPaginationSnapshot = (value: unknown): value is PaginationSnapshot =>
    typeof value === 'object' &&
    value !== null &&
    'page' in value &&
    typeof value.page === 'number' &&
    'size' in value &&
    typeof value.size === 'number' &&
    'total' in value &&
    typeof value.total === 'number'

  const getGridViewerProps = (index = 0) => {
    const props = vi.mocked(BCGridViewer).mock.calls[index]?.[0]
    if (!props) throw new Error(`Grid viewer call ${index} was not recorded`)
    return props
  }

  const getQuerySnapshot = (index: number): QuerySnapshot => {
    const data = getGridViewerProps(index).queryData?.data
    if (!data || !isGridViewerRows(data.items)) {
      throw new Error(`Grid viewer call ${index} has no item data`)
    }
    const items = data.items
    const pagination = data.pagination
    if (pagination === undefined) return { items, pagination: undefined }
    if (!isPaginationSnapshot(pagination)) {
      throw new Error(`Grid viewer call ${index} has invalid pagination`)
    }
    return { items, pagination }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    testMocks.useParams.mockReturnValue({
      complianceReportId: mockComplianceReportId,
      compliancePeriod: mockCompliancePeriod
    })

    testMocks.useTranslation.mockReturnValue({
      t: mockTranslate
    })
    testMocks.useFuelSupplyOptions.mockReturnValue({
      data: { fuelTypes: [] },
      isLoading: false
    })

    testMocks.useComplianceReportWithCache.mockReturnValue({
      data: mockComplianceReport,
      isLoading: false
    })

    testMocks.useGetChangeLog.mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })
  })

  describe('Loading States', () => {
    it('should show loading when currentReport is loading', () => {
      testMocks.useComplianceReportWithCache.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<FuelSupplyChangelog />)

      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    it('should show loading when changelog data is loading', () => {
      testMocks.useGetChangeLog.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<FuelSupplyChangelog />)

      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })
  })

  describe('Component Rendering', () => {
    it('should render changelog items when data is available', () => {
      render(<FuelSupplyChangelog />)

      expect(
        screen.getByTestId('bc-grid-viewer-fuel-supply-changelog-0')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('bc-grid-viewer-fuel-supply-changelog-1')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('bc-grid-viewer-fuel-supply-changelog-2')
      ).toBeInTheDocument()
    })

    it('should render with empty changelog data gracefully', () => {
      testMocks.useGetChangeLog.mockReturnValue({
        data: [],
        isLoading: false
      })

      render(<FuelSupplyChangelog />)

      expect(
        screen.queryByTestId('bc-grid-viewer-fuel-supply-changelog-0')
      ).not.toBeInTheDocument()
    })

    it('should handle null changelog data', () => {
      testMocks.useGetChangeLog.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<FuelSupplyChangelog />)

      expect(
        screen.queryByTestId('bc-grid-viewer-fuel-supply-changelog-0')
      ).not.toBeInTheDocument()
    })

    it('should render version nicknames', () => {
      render(<FuelSupplyChangelog />)

      expect(screen.getByText('Current Version')).toBeInTheDocument()
      expect(screen.getByText('Original Version')).toBeInTheDocument()
      expect(screen.getByText('Small Version')).toBeInTheDocument()
    })
  })

  describe('getRowId function', () => {
    it('should convert fuelSupplyId to string', () => {
      render(<FuelSupplyChangelog />)

      const result = getFuelSupplyRowId(123)
      expect(result).toBe('123')
    })
  })

  describe('gridOptions function', () => {
    it('should apply DELETE styling when highlight is true', () => {
      render(<FuelSupplyChangelog />)

      const deleteRowStyle = getFuelSupplyChangelogRowStyle('DELETE', true)
      expect(deleteRowStyle).toEqual({
        backgroundColor: '#ffebee'
      })
    })

    it('should apply CREATE styling when highlight is true', () => {
      render(<FuelSupplyChangelog />)

      const createRowStyle = getFuelSupplyChangelogRowStyle('CREATE', true)
      expect(createRowStyle).toEqual({
        backgroundColor: '#e8f5e8'
      })
    })

    it('should return undefined styling for other action types when highlight is true', () => {
      render(<FuelSupplyChangelog />)

      const otherRowStyle = getFuelSupplyChangelogRowStyle('OTHER', true)
      expect(otherRowStyle).toBeUndefined()
    })

    it('should return undefined when highlight is false', () => {
      render(<FuelSupplyChangelog />)

      const rowStyle = getFuelSupplyChangelogRowStyle('DELETE', false)
      expect(rowStyle).toBeUndefined()
    })

    it('should include translation key for no rows template', () => {
      render(<FuelSupplyChangelog />)

      const gridOptions = getGridViewerProps(0).gridOptions

      expect(gridOptions?.overlayNoRowsTemplate).toBe(
        'fuelSupply:noFuelSuppliesFound'
      )
      expect(mockTranslate).toHaveBeenCalledWith(
        'fuelSupply:noFuelSuppliesFound'
      )
    })
  })

  describe('getPaginatedData function', () => {
    it('should not paginate for small datasets that are not current/original', () => {
      render(<FuelSupplyChangelog />)

      const queryData = getQuerySnapshot(2)

      expect(queryData.items).toHaveLength(1)
      expect(queryData.pagination).toBeUndefined()
    })

    it('should paginate for current/original versions regardless of size', () => {
      render(<FuelSupplyChangelog />)

      const queryData = getQuerySnapshot(1)

      expect(queryData.pagination).toBeDefined()
      expect(queryData.pagination?.page).toBe(1)
      expect(queryData.pagination?.size).toBe(10)
    })

    it('should paginate for large datasets', () => {
      render(<FuelSupplyChangelog />)

      const queryData = getQuerySnapshot(0)

      expect(queryData.pagination).toBeDefined()
      expect(queryData.items.length).toBeLessThanOrEqual(10) // Paginated
      expect(queryData.pagination?.total).toBe(15)
    })
  })

  describe('handlePaginationChange function', () => {
    it('should update pagination state correctly', () => {
      render(<FuelSupplyChangelog />)

      // Find a pagination trigger button and click it
      const paginationButton = screen.getAllByTestId('pagination-trigger')[0]
      fireEvent.click(paginationButton)

      // Verify the component re-renders with new pagination
      // This indirectly tests the pagination state update
      expect(
        screen.getByTestId('bc-grid-viewer-fuel-supply-changelog-0')
      ).toBeInTheDocument()
    })
  })

  describe('Version Logic', () => {
    it('should identify current version (index 0) correctly', () => {
      render(<FuelSupplyChangelog />)

      const gridViewer = vi.mocked(BCGridViewer)
      const currentVersionCall = gridViewer.mock.calls[0]

      // Current version should use changelogCommonColDefs(false)
      expect(changelogCommonColDefs).toHaveBeenCalledWith(false, false, 2024, {
        fuelTypes: []
      })
      expect(currentVersionCall[0].columnDefs).toEqual([
        { field: 'common', showActions: false }
      ])
    })

    it('should identify original version (version 0) correctly', () => {
      render(<FuelSupplyChangelog />)

      const gridViewer = vi.mocked(BCGridViewer)
      const originalVersionCall = gridViewer.mock.calls[1]

      // Original version should use changelogCommonColDefs(false)
      expect(changelogCommonColDefs).toHaveBeenCalledWith(false, false, 2024, {
        fuelTypes: []
      })
      expect(originalVersionCall[0].columnDefs).toEqual([
        { field: 'common', showActions: false }
      ])
    })

    it('should handle regular versions correctly', () => {
      render(<FuelSupplyChangelog />)

      const gridViewer = vi.mocked(BCGridViewer)
      const regularVersionCall = gridViewer.mock.calls[2]

      // Regular version should use changelogColDefs()
      expect(changelogColDefs).toHaveBeenCalled()
      expect(regularVersionCall[0].columnDefs).toEqual([
        { field: 'actionType' }
      ])
    })
  })

  describe('BCGridViewer Props', () => {
    it('should pass correct suppressPagination prop', () => {
      render(<FuelSupplyChangelog />)

      const gridViewer = vi.mocked(BCGridViewer)

      // Large dataset should not suppress pagination
      expect(gridViewer.mock.calls[0][0].suppressPagination).toBe(false)

      // Small dataset should suppress pagination
      expect(gridViewer.mock.calls[2][0].suppressPagination).toBe(true)
    })

    it('should pass correct paginationOptions when needed', () => {
      render(<FuelSupplyChangelog />)

      const gridViewer = vi.mocked(BCGridViewer)

      // Large dataset should have pagination options
      expect(gridViewer.mock.calls[0][0].paginationOptions).toBeDefined()

      // Small dataset should not have pagination options
      expect(gridViewer.mock.calls[2][0].paginationOptions).toBeUndefined()
    })

    it('should pass correct onPaginationChange when needed', () => {
      render(<FuelSupplyChangelog />)

      const gridViewer = vi.mocked(BCGridViewer)

      // Large dataset should have pagination change handler
      expect(gridViewer.mock.calls[0][0].onPaginationChange).toBeDefined()
      expect(typeof gridViewer.mock.calls[0][0].onPaginationChange).toBe(
        'function'
      )

      // Small dataset should not have pagination change handler
      expect(gridViewer.mock.calls[2][0].onPaginationChange).toBeUndefined()
    })

    it('should pass correct gridKey for each item', () => {
      render(<FuelSupplyChangelog />)

      const gridViewer = vi.mocked(BCGridViewer)

      expect(gridViewer.mock.calls[0][0].gridKey).toBe(
        'fuel-supply-changelog-0'
      )
      expect(gridViewer.mock.calls[1][0].gridKey).toBe(
        'fuel-supply-changelog-1'
      )
      expect(gridViewer.mock.calls[2][0].gridKey).toBe(
        'fuel-supply-changelog-2'
      )
    })

    it('should pass enablePageCaching as false', () => {
      render(<FuelSupplyChangelog />)

      const gridViewer = vi.mocked(BCGridViewer)

      gridViewer.mock.calls.forEach((call) => {
        expect(call[0].enablePageCaching).toBe(false)
      })
    })
  })

  describe('Hook Integration', () => {
    it('should call useComplianceReportWithCache with correct complianceReportId', () => {
      render(<FuelSupplyChangelog />)

      expect(testMocks.useComplianceReportWithCache).toHaveBeenCalledWith(
        mockComplianceReportId
      )
    })

    it('should call useGetChangeLog with correct parameters', () => {
      render(<FuelSupplyChangelog />)

      expect(testMocks.useGetChangeLog).toHaveBeenCalledWith({
        complianceReportGroupUuid: 'test-group-uuid',
        dataType: 'fuel-supplies'
      })
    })

    it('should call useTranslation with correct namespaces', () => {
      render(<FuelSupplyChangelog />)

      expect(testMocks.useTranslation).toHaveBeenCalledWith([
        'common',
        'fuelSupply',
        'report'
      ])
    })
  })
})
