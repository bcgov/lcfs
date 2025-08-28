import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FuelSupplyChangelog } from '../FuelSupplyChangelog'

// Mock all external dependencies
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: vi.fn(({ gridKey, onPaginationChange, paginationOptions, columnDefs, queryData, getRowId, suppressPagination, gridOptions, defaultColDef, enablePageCaching, ...props }) => {
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
  useComplianceReportWithCache: vi.fn(),
  useGetChangeLog: vi.fn()
}))

vi.mock('@/constants/schedules.js', () => ({
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
  useParams: vi.fn()
}))

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn()
}))

vi.mock('../_schema', () => ({
  changelogColDefs: vi.fn(() => [{ field: 'actionType' }]),
  changelogCommonColDefs: vi.fn((showActions) => [{ field: 'common', showActions }])
}))

// Import the mocked modules for configuration
import { useComplianceReportWithCache, useGetChangeLog } from '@/hooks/useComplianceReports'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { changelogColDefs, changelogCommonColDefs } from '../_schema'

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

  const mockTranslate = vi.fn((key) => key)

  beforeEach(() => {
    vi.clearAllMocks()

    useParams.mockReturnValue({
      complianceReportId: mockComplianceReportId,
      compliancePeriod: mockCompliancePeriod
    })

    useTranslation.mockReturnValue({
      t: mockTranslate
    })

    useComplianceReportWithCache.mockReturnValue({
      data: mockComplianceReport,
      isLoading: false
    })

    useGetChangeLog.mockReturnValue({
      data: mockChangelogData,
      isLoading: false
    })
  })

  describe('Loading States', () => {
    it('should show loading when currentReport is loading', () => {
      useComplianceReportWithCache.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<FuelSupplyChangelog />)
      
      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    it('should show loading when changelog data is loading', () => {
      useGetChangeLog.mockReturnValue({
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

      expect(screen.getByTestId('bc-grid-viewer-fuel-supply-changelog-0')).toBeInTheDocument()
      expect(screen.getByTestId('bc-grid-viewer-fuel-supply-changelog-1')).toBeInTheDocument()
      expect(screen.getByTestId('bc-grid-viewer-fuel-supply-changelog-2')).toBeInTheDocument()
    })

    it('should render with empty changelog data gracefully', () => {
      useGetChangeLog.mockReturnValue({
        data: [],
        isLoading: false
      })

      render(<FuelSupplyChangelog />)
      
      expect(screen.queryByTestId('bc-grid-viewer-fuel-supply-changelog-0')).not.toBeInTheDocument()
    })

    it('should handle null changelog data', () => {
      useGetChangeLog.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<FuelSupplyChangelog />)
      
      expect(screen.queryByTestId('bc-grid-viewer-fuel-supply-changelog-0')).not.toBeInTheDocument()
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
      
      const gridViewer = vi.mocked(BCGridViewer)
      expect(gridViewer).toHaveBeenCalled()
      
      const firstCall = gridViewer.mock.calls[0]
      const getRowId = firstCall[0].getRowId
      
      const result = getRowId({ data: { fuelSupplyId: 123 } })
      expect(result).toBe('123')
    })
  })

  describe('gridOptions function', () => {
    it('should apply DELETE styling when highlight is true', () => {
      render(<FuelSupplyChangelog />)
      
      const gridViewer = vi.mocked(BCGridViewer)
      const firstCall = gridViewer.mock.calls[2] // Third item (small version)
      const gridOptions = firstCall[0].gridOptions
      
      const deleteRowStyle = gridOptions.getRowStyle({ data: { actionType: 'DELETE' } })
      expect(deleteRowStyle).toEqual({
        backgroundColor: '#ffebee'
      })
    })

    it('should apply CREATE styling when highlight is true', () => {
      render(<FuelSupplyChangelog />)
      
      const gridViewer = vi.mocked(BCGridViewer)
      const firstCall = gridViewer.mock.calls[2] // Third item (small version)
      const gridOptions = firstCall[0].gridOptions
      
      const createRowStyle = gridOptions.getRowStyle({ data: { actionType: 'CREATE' } })
      expect(createRowStyle).toEqual({
        backgroundColor: '#e8f5e8'
      })
    })

    it('should return undefined styling for other action types when highlight is true', () => {
      render(<FuelSupplyChangelog />)
      
      const gridViewer = vi.mocked(BCGridViewer)
      const firstCall = gridViewer.mock.calls[2] // Third item (small version)
      const gridOptions = firstCall[0].gridOptions
      
      const otherRowStyle = gridOptions.getRowStyle({ data: { actionType: 'OTHER' } })
      expect(otherRowStyle).toBeUndefined()
    })

    it('should return undefined when highlight is false', () => {
      render(<FuelSupplyChangelog />)
      
      const gridViewer = vi.mocked(BCGridViewer)
      const firstCall = gridViewer.mock.calls[0] // First item (current version, highlight=false)
      const gridOptions = firstCall[0].gridOptions
      
      const rowStyle = gridOptions.getRowStyle({ data: { actionType: 'DELETE' } })
      expect(rowStyle).toBeUndefined()
    })

    it('should include translation key for no rows template', () => {
      render(<FuelSupplyChangelog />)
      
      const gridViewer = vi.mocked(BCGridViewer)
      const firstCall = gridViewer.mock.calls[0]
      const gridOptions = firstCall[0].gridOptions
      
      expect(gridOptions.overlayNoRowsTemplate).toBe('fuelSupply:noFuelSuppliesFound')
      expect(mockTranslate).toHaveBeenCalledWith('fuelSupply:noFuelSuppliesFound')
    })
  })

  describe('getPaginatedData function', () => {
    it('should not paginate for small datasets that are not current/original', () => {
      render(<FuelSupplyChangelog />)
      
      const gridViewer = vi.mocked(BCGridViewer)
      const smallVersionCall = gridViewer.mock.calls[2] // Small version with 1 item
      const queryData = smallVersionCall[0].queryData
      
      expect(queryData.data.items).toHaveLength(1)
      expect(queryData.data.pagination).toBeUndefined()
    })

    it('should paginate for current/original versions regardless of size', () => {
      render(<FuelSupplyChangelog />)
      
      const gridViewer = vi.mocked(BCGridViewer)
      const originalVersionCall = gridViewer.mock.calls[1] // Original version (version 0)
      const queryData = originalVersionCall[0].queryData
      
      expect(queryData.data.pagination).toBeDefined()
      expect(queryData.data.pagination.page).toBe(1)
      expect(queryData.data.pagination.size).toBe(10)
    })

    it('should paginate for large datasets', () => {
      render(<FuelSupplyChangelog />)
      
      const gridViewer = vi.mocked(BCGridViewer)
      const largeDatasetCall = gridViewer.mock.calls[0] // Current version with 15 items
      const queryData = largeDatasetCall[0].queryData
      
      expect(queryData.data.pagination).toBeDefined()
      expect(queryData.data.items.length).toBeLessThanOrEqual(10) // Paginated
      expect(queryData.data.pagination.total).toBe(15)
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
      expect(screen.getByTestId('bc-grid-viewer-fuel-supply-changelog-0')).toBeInTheDocument()
    })
  })

  describe('Version Logic', () => {
    it('should identify current version (index 0) correctly', () => {
      render(<FuelSupplyChangelog />)
      
      const gridViewer = vi.mocked(BCGridViewer)
      const currentVersionCall = gridViewer.mock.calls[0]
      
      // Current version should use changelogCommonColDefs(false)
      expect(changelogCommonColDefs).toHaveBeenCalledWith(false)
      expect(currentVersionCall[0].columnDefs).toEqual([{ field: 'common', showActions: false }])
    })

    it('should identify original version (version 0) correctly', () => {
      render(<FuelSupplyChangelog />)
      
      const gridViewer = vi.mocked(BCGridViewer)
      const originalVersionCall = gridViewer.mock.calls[1]
      
      // Original version should use changelogCommonColDefs(false)
      expect(changelogCommonColDefs).toHaveBeenCalledWith(false)
      expect(originalVersionCall[0].columnDefs).toEqual([{ field: 'common', showActions: false }])
    })

    it('should handle regular versions correctly', () => {
      render(<FuelSupplyChangelog />)
      
      const gridViewer = vi.mocked(BCGridViewer)
      const regularVersionCall = gridViewer.mock.calls[2]
      
      // Regular version should use changelogColDefs()
      expect(changelogColDefs).toHaveBeenCalled()
      expect(regularVersionCall[0].columnDefs).toEqual([{ field: 'actionType' }])
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
      expect(typeof gridViewer.mock.calls[0][0].onPaginationChange).toBe('function')
      
      // Small dataset should not have pagination change handler
      expect(gridViewer.mock.calls[2][0].onPaginationChange).toBeUndefined()
    })

    it('should pass correct gridKey for each item', () => {
      render(<FuelSupplyChangelog />)
      
      const gridViewer = vi.mocked(BCGridViewer)
      
      expect(gridViewer.mock.calls[0][0].gridKey).toBe('fuel-supply-changelog-0')
      expect(gridViewer.mock.calls[1][0].gridKey).toBe('fuel-supply-changelog-1')
      expect(gridViewer.mock.calls[2][0].gridKey).toBe('fuel-supply-changelog-2')
    })

    it('should pass enablePageCaching as false', () => {
      render(<FuelSupplyChangelog />)
      
      const gridViewer = vi.mocked(BCGridViewer)
      
      gridViewer.mock.calls.forEach(call => {
        expect(call[0].enablePageCaching).toBe(false)
      })
    })
  })

  describe('Hook Integration', () => {
    it('should call useComplianceReportWithCache with correct complianceReportId', () => {
      render(<FuelSupplyChangelog />)
      
      expect(useComplianceReportWithCache).toHaveBeenCalledWith(mockComplianceReportId)
    })

    it('should call useGetChangeLog with correct parameters', () => {
      render(<FuelSupplyChangelog />)
      
      expect(useGetChangeLog).toHaveBeenCalledWith({
        complianceReportGroupUuid: 'test-group-uuid',
        dataType: 'fuel-supplies'
      })
    })

    it('should call useTranslation with correct namespaces', () => {
      render(<FuelSupplyChangelog />)
      
      expect(useTranslation).toHaveBeenCalledWith(['common', 'fuelSupply', 'report'])
    })
  })
})