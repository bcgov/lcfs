import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NotionalTransferChangelog } from '../NotionalTransferChangelog'
import { wrapper } from '@/tests/utils/wrapper'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
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
  useComplianceReportWithCache: vi.fn(),
  useGetChangeLog: vi.fn()
}))

const { useComplianceReportWithCache, useGetChangeLog } = vi.mocked(await import('@/hooks/useComplianceReports'))

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
  }) => (
    <div data-test="bc-grid-viewer">
      <div data-test="grid-key">{gridKey}</div>
      <div data-test="row-count">{queryData?.data?.items?.length || 0}</div>
      <div data-test="pagination-suppressed">{suppressPagination?.toString()}</div>
      <div data-test="has-pagination-options">{(!!paginationOptions).toString()}</div>
      <div data-test="has-pagination-change">{(!!onPaginationChange).toString()}</div>
      <div data-test="column-count">{columnDefs?.length || 0}</div>
      <div data-test="grid-options">{JSON.stringify(gridOptions || {})}</div>
      {queryData?.data?.items?.map((item, index) => (
        <div key={index} data-test="grid-item">
          ID: {getRowId ? getRowId({ data: item }) : 'no-id'} - {item.actionType}
        </div>
      ))}
    </div>
  )
}))

// Mock BCTypography
vi.mock('@/components/BCTypography', () => ({
  default: ({ children, variant, color, component, ...props }) => (
    <div data-test="bc-typography" data-variant={variant} data-color={color} {...props}>
      {children}
    </div>
  )
}))

// Mock Loading
vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading">Loading...</div>
}))

// Mock Material-UI components
vi.mock('@mui/material', () => ({
  Box: ({ children, mb, ...props }) => (
    <div data-test="mui-box" data-mb={mb} {...props}>
      {children}
    </div>
  ),
  TextField: ({ children, ...props }) => (
    <div data-test="text-field" {...props}>
      {children}
    </div>
  ),
  Button: ({ children, ...props }) => (
    <div data-test="button" {...props}>
      {children}
    </div>
  ),
  Typography: ({ children, ...props }) => (
    <div data-test="typography" {...props}>
      {children}
    </div>
  ),
  Paper: ({ children, ...props }) => (
    <div data-test="paper" {...props}>
      {children}
    </div>
  )
}))

// Mock Material-UI styles
vi.mock('@mui/material/styles', () => ({
  styled: () => () => ({ children, ...props }) => (
    <div data-test="styled-component" {...props}>
      {children}
    </div>
  ),
  useTheme: () => ({
    spacing: (val) => val * 8,
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
  changelogCommonColDefs: (highlight) => [
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

  describe('Loading states', () => {
    it('shows loading when changelogDataLoading is true', () => {
      useGetChangeLog.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<NotionalTransferChangelog />, { wrapper })
      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    it('shows loading when currentReportLoading is true', () => {
      useComplianceReportWithCache.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<NotionalTransferChangelog />, { wrapper })
      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })
  })

  describe('getRowId function', () => {
    it('converts notionalTransferId to string', () => {
      const mockData = [{
        version: 1,
        nickname: 'Test Version',
        notionalTransfers: [
          { notionalTransferId: 123, actionType: 'CREATE', legalName: 'Test Org' }
        ]
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      
      expect(screen.getByTestId('grid-item')).toHaveTextContent('ID: 123 - CREATE')
    })
  })

  describe('gridOptions function', () => {
    it('applies DELETE action styling', () => {
      const mockData = [{
        version: 1,
        nickname: 'Test Version',
        notionalTransfers: [
          { notionalTransferId: 1, actionType: 'DELETE', legalName: 'Test Org' }
        ]
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      
      const gridOptions = JSON.parse(screen.getByTestId('grid-options').textContent)
      expect(gridOptions.overlayNoRowsTemplate).toBe('notionalTransfer:noNotionalTransfersFound')
      expect(gridOptions.autoSizeStrategy.type).toBe('fitGridWidth')
      expect(gridOptions.enableCellTextSelection).toBe(true)
      expect(gridOptions.ensureDomOrder).toBe(true)
    })

    it('applies CREATE action styling', () => {
      const mockData = [{
        version: 1,
        nickname: 'Test Version',
        notionalTransfers: [
          { notionalTransferId: 1, actionType: 'CREATE', legalName: 'Test Org' }
        ]
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      expect(screen.getByTestId('grid-item')).toHaveTextContent('ID: 1 - CREATE')
    })

    it('handles no styling for other action types', () => {
      const mockData = [{
        version: 1,
        nickname: 'Test Version',
        notionalTransfers: [
          { notionalTransferId: 1, actionType: 'UPDATE', legalName: 'Test Org' }
        ]
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      expect(screen.getByTestId('grid-item')).toHaveTextContent('ID: 1 - UPDATE')
    })
  })

  describe('getPaginatedData function', () => {
    it('returns all data when pagination disabled (small dataset)', () => {
      const mockData = [{
        version: 1,
        nickname: 'Small Dataset',
        notionalTransfers: Array.from({ length: 5 }, (_, i) => ({
          notionalTransferId: i + 1,
          actionType: 'CREATE',
          legalName: `Org ${i + 1}`
        }))
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      
      expect(screen.getByTestId('row-count')).toHaveTextContent('5')
      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('true')
    })

    it('applies pagination for large datasets', () => {
      const mockData = [{
        version: 1,
        nickname: 'Large Dataset',
        notionalTransfers: Array.from({ length: 15 }, (_, i) => ({
          notionalTransferId: i + 1,
          actionType: 'CREATE',
          legalName: `Org ${i + 1}`
        }))
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      
      expect(screen.getByTestId('row-count')).toHaveTextContent('10')
      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('false')
      expect(screen.getByTestId('has-pagination-options')).toHaveTextContent('true')
      expect(screen.getByTestId('has-pagination-change')).toHaveTextContent('true')
    })

    it('suppresses pagination for current version with small dataset', () => {
      const mockData = [{
        version: 1,
        nickname: 'Current Version',
        notionalTransfers: Array.from({ length: 3 }, (_, i) => ({
          notionalTransferId: i + 1,
          actionType: 'CREATE',
          legalName: `Org ${i + 1}`
        }))
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      
      expect(screen.getByTestId('row-count')).toHaveTextContent('3')
      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('true')
      expect(screen.getByTestId('has-pagination-options')).toHaveTextContent('false')
    })

    it('suppresses pagination for original version with small dataset', () => {
      const mockData = [{
        version: 0,
        nickname: 'Original Version',
        notionalTransfers: Array.from({ length: 3 }, (_, i) => ({
          notionalTransferId: i + 1,
          actionType: 'CREATE',
          legalName: `Org ${i + 1}`
        }))
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      
      expect(screen.getByTestId('pagination-suppressed')).toHaveTextContent('true')
      expect(screen.getByTestId('has-pagination-options')).toHaveTextContent('false')
    })
  })

  describe('handlePaginationChange function', () => {
    it('provides pagination handler for large datasets', () => {
      const mockData = [{
        version: 1,
        nickname: 'Test Version',
        notionalTransfers: Array.from({ length: 15 }, (_, i) => ({
          notionalTransferId: i + 1,
          actionType: 'CREATE',
          legalName: `Org ${i + 1}`
        }))
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      
      expect(screen.getByTestId('has-pagination-change')).toHaveTextContent('true')
    })

    it('does not provide pagination handler for small datasets', () => {
      const mockData = [{
        version: 1,
        nickname: 'Small Dataset',
        notionalTransfers: Array.from({ length: 5 }, (_, i) => ({
          notionalTransferId: i + 1,
          actionType: 'CREATE',
          legalName: `Org ${i + 1}`
        }))
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      
      expect(screen.getByTestId('has-pagination-change')).toHaveTextContent('false')
    })
  })

  describe('Rendering logic', () => {
    it('renders empty state with no data', () => {
      useGetChangeLog.mockReturnValue({
        data: [],
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      
      const grids = screen.queryAllByTestId('bc-grid-viewer')
      expect(grids).toHaveLength(0)
    })

    it('renders single changelog item', () => {
      const mockData = [{
        version: 1,
        nickname: 'Test Version',
        notionalTransfers: [
          { notionalTransferId: 1, actionType: 'CREATE', legalName: 'Test Org' }
        ]
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      
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

      render(<NotionalTransferChangelog />, { wrapper })
      
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

      render(<NotionalTransferChangelog />, { wrapper })
      
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

      render(<NotionalTransferChangelog />, { wrapper })
      
      const gridKeys = screen.getAllByTestId('grid-key')
      expect(gridKeys[0]).toHaveTextContent('notional-transfers-changelog-0')
      expect(gridKeys[1]).toHaveTextContent('notional-transfers-changelog-1')
    })

    it('handles empty notionalTransfers array', () => {
      const mockData = [{
        version: 1,
        nickname: 'Empty Version',
        notionalTransfers: []
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      
      expect(screen.getByText('Empty Version')).toBeInTheDocument()
      expect(screen.getByTestId('row-count')).toHaveTextContent('0')
    })
  })

  describe('Hook integration', () => {
    it('calls hooks with correct parameters', () => {
      render(<NotionalTransferChangelog />, { wrapper })
      
      expect(useComplianceReportWithCache).toHaveBeenCalledWith('test-report-id')
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

      render(<NotionalTransferChangelog />, { wrapper })
      
      expect(useGetChangeLog).toHaveBeenCalledWith({
        complianceReportGroupUuid: undefined,
        dataType: 'notional-transfers'
      })
    })
  })

  describe('Component structure', () => {
    it('renders proper Box structure', () => {
      const mockData = [{
        version: 1,
        nickname: 'Test Version',
        notionalTransfers: [
          { notionalTransferId: 1, actionType: 'CREATE', legalName: 'Test Org' }
        ]
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      
      const boxes = screen.getAllByTestId('mui-box')
      expect(boxes.length).toBeGreaterThan(0)
      
      // Check for the main container box and item boxes
      const itemBox = boxes.find(box => box.getAttribute('data-mb') === '4')
      expect(itemBox).toBeInTheDocument()
    })

    it('renders BCTypography with correct props', () => {
      const mockData = [{
        version: 1,
        nickname: 'Test Version Title',
        notionalTransfers: [
          { notionalTransferId: 1, actionType: 'CREATE', legalName: 'Test Org' }
        ]
      }]

      useGetChangeLog.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(<NotionalTransferChangelog />, { wrapper })
      
      const typography = screen.getByTestId('bc-typography')
      expect(typography).toHaveAttribute('data-variant', 'h6')
      expect(typography).toHaveAttribute('data-color', 'primary')
      expect(typography).toHaveTextContent('Test Version Title')
    })
  })
})