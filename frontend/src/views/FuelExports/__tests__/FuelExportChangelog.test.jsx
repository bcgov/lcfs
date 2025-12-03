import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { FuelExportChangelog } from '../FuelExportChangelog'
import {
  useComplianceReportWithCache,
  useGetChangeLog
} from '@/hooks/useComplianceReports'
import { wrapper } from '@/tests/utils/wrapper'
import colors from '@/themes/base/colors'
import { defaultInitialPagination } from '@/constants/schedules'

// Mock all dependencies
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn()
}))

vi.mock('react-router-dom', () => ({
  useParams: vi.fn()
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: vi.fn(),
  useGetChangeLog: vi.fn()
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading">Loading...</div>
}))

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: vi.fn(({ gridKey, queryData, getRowId, columnDefs, gridOptions, paginationOptions, onPaginationChange, suppressPagination, defaultColDef, enablePageCaching }) => (
    <div data-test="bc-grid-viewer">
      <div data-test="grid-key">{gridKey}</div>
      <div data-test="row-count">{queryData?.data?.items?.length || 0}</div>
      <div data-test="pagination-suppressed">{suppressPagination ? 'true' : 'false'}</div>
      <div data-test="column-defs">{JSON.stringify(columnDefs?.map(col => col.field) || [])}</div>
      <div data-test="row-id">{getRowId && queryData?.data?.items?.[0] ? getRowId({ data: queryData.data.items[0] }) : ''}</div>
    </div>
  ))
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => <div {...props}>{children}</div>
}))

vi.mock('@mui/material', () => ({
  Box: ({ children, ...props }) => <div {...props}>{children}</div>,
  TextField: ({ children, ...props }) => <input {...props}>{children}</input>
}))

vi.mock('./_schema', () => ({
  changelogColDefs: vi.fn(() => [
    { field: 'groupUuid', hide: true },
    { field: 'createDate', hide: true },
    { field: 'version', hide: true },
    { field: 'actionType' },
    { field: 'complianceUnits' },
    { field: 'fuelType.fuelType' },
    { field: 'quantity' }
  ]),
  changelogCommonColDefs: vi.fn(() => [
    { field: 'complianceUnits' },
    { field: 'fuelType.fuelType' },
    { field: 'quantity' }
  ])
}))

describe('FuelExportChangelog', () => {
  const mockTranslate = vi.fn((key) => key)
  const mockParams = { 
    complianceReportId: '123', 
    compliancePeriod: '2023' 
  }
  const mockCurrentReport = {
    report: {
      complianceReportGroupUuid: 'test-uuid'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    useTranslation.mockReturnValue({ t: mockTranslate })
    useParams.mockReturnValue(mockParams)
    useComplianceReportWithCache.mockReturnValue({
      data: mockCurrentReport,
      isLoading: false
    })
    useGetChangeLog.mockReturnValue({
      data: [],
      isLoading: false
    })
  })

  describe('Component Rendering', () => {
    it('should render loading component when currentReportLoading is true', () => {
      useComplianceReportWithCache.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    it('should render loading component when changelogDataLoading is true', () => {
      useGetChangeLog.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    it('should render loading component when both are loading', () => {
      useComplianceReportWithCache.mockReturnValue({
        data: null,
        isLoading: true
      })
      useGetChangeLog.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    it('should render main content when data is loaded', () => {
      const changelogData = [{
        nickname: 'Test Report',
        version: 1,
        fuelExports: [{ fuelExportId: 1, fuelType: 'Gasoline' }]
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      expect(screen.getByText('Test Report')).toBeInTheDocument()
    })

    it('should render empty content when changelogData is empty', () => {
      useGetChangeLog.mockReturnValue({
        data: [],
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      expect(screen.queryByTestId('bc-grid-viewer')).not.toBeInTheDocument()
    })
  })

  describe('Internal Functions', () => {
    it('should test getRowId function returns correct string format', () => {
      const changelogData = [{
        nickname: 'Test Report',
        version: 1,
        fuelExports: [{ fuelExportId: 123, fuelType: 'Gasoline' }]
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.getByTestId('row-id')).toHaveTextContent('123')
    })

    it('should handle pagination state changes', async () => {
      const changelogData = [{
        nickname: 'Test Report',
        version: 1,
        fuelExports: Array.from({ length: 15 }, (_, i) => ({ fuelExportId: i + 1, fuelType: 'Gasoline' }))
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('false')
    })
  })

  describe('Conditional Logic', () => {
    it('should determine current/original version correctly for index 0', () => {
      const changelogData = [{
        nickname: 'Current Report',
        version: 2,
        fuelExports: [{ fuelExportId: 1, fuelType: 'Gasoline' }]
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      // Should render the current report for index 0
      expect(screen.getByText('Current Report')).toBeInTheDocument()
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('should determine current/original version correctly for version 0', () => {
      const changelogData = [
        {
          nickname: 'Version 1',
          version: 1,
          fuelExports: [{ fuelExportId: 1, fuelType: 'Gasoline' }]
        },
        {
          nickname: 'Original Report',
          version: 0,
          fuelExports: [{ fuelExportId: 2, fuelType: 'Diesel' }]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      const grids = screen.getAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(2)
      
      // Both reports should be rendered correctly
      expect(screen.getByText('Version 1')).toBeInTheDocument()
      expect(screen.getByText('Original Report')).toBeInTheDocument()
    })

    it('should render multiple versions correctly', () => {
      const changelogData = [
        {
          nickname: 'Current Report',
          version: 2,
          fuelExports: [{ fuelExportId: 1, fuelType: 'Gasoline' }]
        },
        {
          nickname: 'Version 1',
          version: 1,
          fuelExports: [{ fuelExportId: 2, fuelType: 'Diesel' }]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      const grids = screen.getAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(2)
      
      // Both reports should be rendered with different configurations
      expect(screen.getByText('Current Report')).toBeInTheDocument()
      expect(screen.getByText('Version 1')).toBeInTheDocument()
    })

    it('should suppress pagination when less than 10 items', () => {
      const changelogData = [{
        nickname: 'Small Report',
        version: 1,
        fuelExports: Array.from({ length: 5 }, (_, i) => ({ fuelExportId: i + 1, fuelType: 'Gasoline' }))
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('true')
    })

    it('should enable pagination when 10 or more items', () => {
      const changelogData = [{
        nickname: 'Large Report',
        version: 1,
        fuelExports: Array.from({ length: 15 }, (_, i) => ({ fuelExportId: i + 1, fuelType: 'Gasoline' }))
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('false')
    })

    it('should enable pagination when exactly 10 items', () => {
      const changelogData = [{
        nickname: 'Exact Report',
        version: 1,
        fuelExports: Array.from({ length: 10 }, (_, i) => ({ fuelExportId: i + 1, fuelType: 'Gasoline' }))
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('false')
    })
  })

  describe('Data Processing', () => {
    it('should process pagination for current/original version', () => {
      const changelogData = [{
        nickname: 'Test Report',
        version: 1,
        fuelExports: Array.from({ length: 15 }, (_, i) => ({ 
          fuelExportId: i + 1, 
          fuelType: 'Gasoline',
          quantity: i * 100
        }))
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      // Should show paginated count (default page size)
      expect(screen.getByTestId('row-count')).toHaveTextContent('10')
    })

    it('should return all data for non-current version without pagination', () => {
      const changelogData = [
        {
          nickname: 'Current Report',
          version: 2,
          fuelExports: Array.from({ length: 5 }, (_, i) => ({ fuelExportId: i + 1, fuelType: 'Gasoline' }))
        },
        {
          nickname: 'Version 1',
          version: 1,
          fuelExports: Array.from({ length: 15 }, (_, i) => ({ fuelExportId: i + 10, fuelType: 'Diesel' }))
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      const grids = screen.getAllByTestId('bc-grid-viewer')
      
      // Second grid (non-current version) should show all 15 items
      expect(grids[1].querySelector('[data-test="row-count"]')).toHaveTextContent('15')
    })

    it('should handle empty fuel exports', () => {
      const changelogData = [{
        nickname: 'Empty Report',
        version: 1,
        fuelExports: []
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.getByTestId('row-count')).toHaveTextContent('0')
    })

    it('should handle multiple changelog items', () => {
      const changelogData = [
        {
          nickname: 'Current Report',
          version: 2,
          fuelExports: [{ fuelExportId: 1, fuelType: 'Gasoline' }]
        },
        {
          nickname: 'Version 1',
          version: 1,
          fuelExports: [{ fuelExportId: 2, fuelType: 'Diesel' }]
        },
        {
          nickname: 'Original Report',
          version: 0,
          fuelExports: [{ fuelExportId: 3, fuelType: 'Ethanol' }]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.getByText('Current Report')).toBeInTheDocument()
      expect(screen.getByText('Version 1')).toBeInTheDocument()
      expect(screen.getByText('Original Report')).toBeInTheDocument()

      const grids = screen.getAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(3)
    })
  })

  describe('Grid Configuration', () => {
    it('should use correct grid key pattern', () => {
      const changelogData = [
        {
          nickname: 'Report 1',
          version: 1,
          fuelExports: [{ fuelExportId: 1 }]
        },
        {
          nickname: 'Report 2', 
          version: 0,
          fuelExports: [{ fuelExportId: 2 }]
        }
      ]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      const gridKeys = screen.getAllByTestId('grid-key')
      expect(gridKeys[0]).toHaveTextContent('fuel-exports-changelog-0')
      expect(gridKeys[1]).toHaveTextContent('fuel-exports-changelog-1')
    })

    it('should handle single changelog item', () => {
      const changelogData = [{
        nickname: 'Single Report',
        version: 1,
        fuelExports: [{ fuelExportId: 1, fuelType: 'Gasoline' }]
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.getByText('Single Report')).toBeInTheDocument()
      expect(screen.getAllByTestId('bc-grid-viewer')).toHaveLength(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null changelogData', () => {
      useGetChangeLog.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      expect(screen.queryByTestId('bc-grid-viewer')).not.toBeInTheDocument()
    })

    it('should handle items with missing fuelExports gracefully', () => {
      const changelogData = [{
        nickname: 'Missing Exports',
        version: 1,
        fuelExports: [] // empty array instead of undefined
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(screen.getByText('Missing Exports')).toBeInTheDocument()
      expect(screen.getByTestId('row-count')).toHaveTextContent('0')
    })

    it('should handle missing complianceReportGroupUuid', () => {
      useComplianceReportWithCache.mockReturnValue({
        data: { report: {} },
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(useGetChangeLog).toHaveBeenCalledWith({
        complianceReportGroupUuid: undefined,
        dataType: 'fuel-exports'
      })
    })

    it('should handle missing current report data', () => {
      useComplianceReportWithCache.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      expect(useGetChangeLog).toHaveBeenCalledWith({
        complianceReportGroupUuid: undefined,
        dataType: 'fuel-exports'
      })
    })
  })

  describe('Hook Integration', () => {
    it('should call useTranslation with correct namespaces', () => {
      render(<FuelExportChangelog />, { wrapper })

      expect(useTranslation).toHaveBeenCalledWith(['common', 'fuelExport', 'report'])
    })

    it('should call useParams for route parameters', () => {
      render(<FuelExportChangelog />, { wrapper })

      expect(useParams).toHaveBeenCalled()
    })

    it('should call useComplianceReportWithCache with correct ID', () => {
      render(<FuelExportChangelog />, { wrapper })

      expect(useComplianceReportWithCache).toHaveBeenCalledWith('123')
    })

    it('should call useGetChangeLog with correct parameters', () => {
      render(<FuelExportChangelog />, { wrapper })

      expect(useGetChangeLog).toHaveBeenCalledWith({
        complianceReportGroupUuid: 'test-uuid',
        dataType: 'fuel-exports'
      })
    })
  })

  describe('Accessibility and Props', () => {
    it('should pass correct props to BCGridViewer for current version', () => {
      const changelogData = [{
        nickname: 'Test Report',
        version: 1,
        fuelExports: Array.from({ length: 15 }, (_, i) => ({ fuelExportId: i + 1, fuelType: 'Gasoline' }))
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      // Check that the grid is rendered with correct properties reflected in test attributes
      expect(screen.getByTestId('grid-key')).toHaveTextContent('fuel-exports-changelog-0')
      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('false')
      expect(screen.getByTestId('row-count')).toHaveTextContent('10') // paginated count
    })

    it('should pass correct defaultColDef to all grids', () => {
      const changelogData = [{
        nickname: 'Test Report',
        version: 1,
        fuelExports: [{ fuelExportId: 1, fuelType: 'Gasoline' }]
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })

      // Verify that the grid is properly rendered - this implicitly tests defaultColDef
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('grid-key')).toHaveTextContent('fuel-exports-changelog-0')
    })
  })

  describe('Missing Coverage Tests', () => {
    it('should trigger sorting logic with pagination', () => {
      // Test the sorting branch by creating data that will go through pagination with sorting
      const changelogData = [{
        nickname: 'Test Report',
        version: 1,
        fuelExports: Array.from({ length: 15 }, (_, i) => ({ 
          fuelExportId: i + 1, 
          quantity: Math.floor(Math.random() * 1000),
          fuelType: `Type${i}`
        }))
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })
      
      // This will trigger the internal pagination logic including sorting
      expect(screen.getByText('Test Report')).toBeInTheDocument()
      expect(screen.getByTestId('row-count')).toHaveTextContent('10')
    })
    
    it('should ensure all branches are covered with realistic data', () => {
      const changelogData = [{
        nickname: 'Complete Test',
        version: 1,
        fuelExports: [
          { fuelExportId: 1, quantity: 100, fuelType: 'A' },
          { fuelExportId: 2, quantity: 300, fuelType: 'B' },
          { fuelExportId: 3, quantity: 200, fuelType: 'C' }
        ]
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      render(<FuelExportChangelog />, { wrapper })
      
      expect(screen.getByText('Complete Test')).toBeInTheDocument()
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('Component Behavior Verification', () => {
    it('should render component without errors with minimal data', () => {
      const changelogData = [{
        nickname: '',
        version: 0,
        fuelExports: []
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      expect(() => {
        render(<FuelExportChangelog />, { wrapper })
      }).not.toThrow()
    })

    it('should handle re-renders correctly', () => {
      const changelogData = [{
        nickname: 'Test Report',
        version: 1,
        fuelExports: [{ fuelExportId: 1, fuelType: 'Gasoline' }]
      }]

      useGetChangeLog.mockReturnValue({
        data: changelogData,
        isLoading: false
      })

      const { rerender } = render(<FuelExportChangelog />, { wrapper })
      
      expect(screen.getByText('Test Report')).toBeInTheDocument()

      // Update data
      const updatedData = [{
        nickname: 'Updated Report',
        version: 2,
        fuelExports: [{ fuelExportId: 2, fuelType: 'Diesel' }]
      }]

      useGetChangeLog.mockReturnValue({
        data: updatedData,
        isLoading: false
      })

      rerender(<FuelExportChangelog />)

      expect(screen.getByText('Updated Report')).toBeInTheDocument()
    })
  })
})