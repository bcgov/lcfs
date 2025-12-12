import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditLog } from '../AuditLog'

// Import the mocked functions
import { auditLogColDefs, defaultAuditLogSortModel } from '../_schema'
import { useAuditLogs } from '@/hooks/useAuditLog.js'

// Mock react-i18next
const mockT = vi.fn((key) => key)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT })
}))

// Mock useAuditLogs hook
vi.mock('@/hooks/useAuditLog.js', () => ({
  useAuditLogs: vi.fn()
}))

// Mock schema imports
vi.mock('../_schema', () => ({
  auditLogColDefs: vi.fn(() => []),
  defaultAuditLogSortModel: [{ field: 'createDate', direction: 'desc' }]
}))

// Mock constants
vi.mock('@/constants/schedules', () => ({
  defaultInitialPagination: {
    page: 1,
    size: 10,
    sortOrders: [],
    filters: []
  }
}))

// Mock LinkRenderer
vi.mock('@/utils/grid/cellRenderers.jsx', () => ({
  LinkRenderer: 'LinkRenderer'
}))

// Mock UI components
vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => <div data-test="bc-box" {...props}>{children}</div>
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => <div data-test="bc-typography" {...props}>{children}</div>
}))

vi.mock('@/components/ClearFiltersButton', () => ({
  ClearFiltersButton: ({ onClick, ...props }) => (
    <button data-test="clear-filters-button" onClick={onClick} {...props}>
      Clear Filters
    </button>
  )
}))

// Mock BCGridViewer with ref forwarding
let capturedGridViewerProps = {}
const mockClearFilters = vi.fn()
let gridRefCallback = null

vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: React.forwardRef((props, ref) => {
    capturedGridViewerProps = props
    
    // Store the ref callback to simulate ref assignment
    gridRefCallback = ref
    
    // Set up ref with clearFilters method
    React.useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') {
          ref({ clearFilters: mockClearFilters })
        } else {
          ref.current = { clearFilters: mockClearFilters }
        }
      }
    }, [ref])
    
    return (
      <div data-test="bc-grid-viewer" data-grid-key={props.gridKey}>
        {/* Test row click and pagination change */}
        <button 
          data-test="test-row-click"
          onClick={() => props.getRowId && props.getRowId({ data: { auditLogId: 123 } })}
        >
          Test Row
        </button>
        <button
          data-test="test-pagination"
          onClick={() => props.onPaginationChange && props.onPaginationChange({ page: 2, size: 20 })}
        >
          Test Pagination
        </button>
      </div>
    )
  })
}))

describe('AuditLog Component', () => {
  const mockQueryData = {
    data: { auditLogs: [] },
    isLoading: false,
    error: null
  }

  beforeEach(() => {
    vi.clearAllMocks()
    capturedGridViewerProps = {}
    vi.mocked(useAuditLogs).mockReturnValue(mockQueryData)
    vi.mocked(auditLogColDefs).mockReturnValue([])
  })

  describe('Component Initialization', () => {
    it('renders without crashing', () => {
      render(<AuditLog />)
      expect(screen.getAllByTestId('bc-box')).toHaveLength(2)
    })

    it('initializes useTranslation hook with correct namespaces', () => {
      render(<AuditLog />)
      expect(mockT).toHaveBeenCalledWith('admin:AuditLog')
    })

    it('initializes useAuditLogs hook with correct parameters', () => {
      render(<AuditLog />)
      expect(vi.mocked(useAuditLogs)).toHaveBeenCalledWith(
        {
          page: 1,
          size: 10,
          sortOrders: defaultAuditLogSortModel,
          filters: []
        },
        {
          cacheTime: 0,
          staleTime: 0
        }
      )
    })
  })

  describe('Component Rendering', () => {
    it('renders main title with correct translation', () => {
      render(<AuditLog />)
      const title = screen.getByTestId('bc-typography')
      expect(title).toHaveTextContent('admin:AuditLog')
    })

    it('renders ClearFiltersButton', () => {
      render(<AuditLog />)
      expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument()
    })

    it('renders BCGridViewer', () => {
      render(<AuditLog />)
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('getRowId Function', () => {
    it('converts auditLogId to string', () => {
      render(<AuditLog />)
      const testButton = screen.getByTestId('test-row-click')
      
      fireEvent.click(testButton)
      
      // The getRowId function should be called and convert the number to string
      expect(typeof capturedGridViewerProps.getRowId({ data: { auditLogId: 123 } })).toBe('string')
      expect(capturedGridViewerProps.getRowId({ data: { auditLogId: 123 } })).toBe('123')
    })

    it('handles different auditLogId types', () => {
      render(<AuditLog />)
      
      // Test with number
      expect(capturedGridViewerProps.getRowId({ data: { auditLogId: 456 } })).toBe('456')
      
      // Test with string
      expect(capturedGridViewerProps.getRowId({ data: { auditLogId: '789' } })).toBe('789')
    })
  })

  describe('handleClearFilters Function', () => {
    it('resets pagination options to initial values', async () => {
      render(<AuditLog />)
      
      // First trigger a pagination change
      const paginationButton = screen.getByTestId('test-pagination')
      await act(async () => {
        fireEvent.click(paginationButton)
      })

      // Verify pagination changed (hook called with new values)
      expect(vi.mocked(useAuditLogs)).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          size: 20
        }),
        expect.any(Object)
      )

      // Clear filters
      const clearButton = screen.getByTestId('clear-filters-button')
      await act(async () => {
        fireEvent.click(clearButton)
      })

      // Verify reset back to initial values
      expect(vi.mocked(useAuditLogs)).toHaveBeenLastCalledWith(
        {
          page: 1,
          size: 10,
          sortOrders: defaultAuditLogSortModel,
          filters: []
        },
        expect.any(Object)
      )
    })

  })

  describe('onPaginationChange Function', () => {
    it('merges new pagination with previous state', async () => {
      render(<AuditLog />)
      
      const paginationButton = screen.getByTestId('test-pagination')
      await act(async () => {
        fireEvent.click(paginationButton)
      })

      expect(vi.mocked(useAuditLogs)).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          size: 20,
          sortOrders: defaultAuditLogSortModel,
          filters: []
        }),
        expect.any(Object)
      )
    })

    it('preserves existing pagination properties', async () => {
      render(<AuditLog />)
      
      // Mock a partial pagination change
      await act(async () => {
        capturedGridViewerProps.onPaginationChange({ page: 3 })
      })

      expect(vi.mocked(useAuditLogs)).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 3,
          size: 10, // Should preserve original size
          sortOrders: defaultAuditLogSortModel,
          filters: []
        }),
        expect.any(Object)
      )
    })
  })

  describe('Grid Configuration', () => {
    beforeEach(() => {
      render(<AuditLog />)
    })

    it('passes correct basic props to BCGridViewer', () => {
      expect(capturedGridViewerProps.dataKey).toBe('auditLogs')
      expect(capturedGridViewerProps.gridKey).toBe('audit-log-grid')
      expect(capturedGridViewerProps.queryData).toBe(mockQueryData)
      expect(capturedGridViewerProps.defaultSortModel).toBe(defaultAuditLogSortModel)
    })

    it('passes correct button configurations', () => {
      expect(capturedGridViewerProps.enableCopyButton).toBe(false)
      expect(capturedGridViewerProps.enableExportButton).toBe(true)
      expect(capturedGridViewerProps.exportName).toBe('AuditLog')
    })

    it('passes correct autoSizeStrategy configuration', () => {
      expect(capturedGridViewerProps.autoSizeStrategy).toEqual({
        type: 'fitGridWidth',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      })
    })

    it('configures defaultColDef with LinkRenderer', () => {
      expect(capturedGridViewerProps.defaultColDef.cellRenderer).toBe('LinkRenderer')
      expect(typeof capturedGridViewerProps.defaultColDef.cellRendererParams.url).toBe('function')
    })

    it('defaultColDef url function returns auditLogId', () => {
      const urlFunction = capturedGridViewerProps.defaultColDef.cellRendererParams.url
      const result = urlFunction({ data: { auditLogId: 999 } })
      expect(result).toBe(999)
    })
  })

  describe('Grid Options', () => {
    beforeEach(() => {
      render(<AuditLog />)
    })

    it('configures gridOptions correctly', () => {
      expect(capturedGridViewerProps.gridOptions.overlayNoRowsTemplate).toBe('admin:auditLogsNotFound')
      expect(capturedGridViewerProps.gridOptions.suppressHeaderMenuButton).toBe(false)
      expect(capturedGridViewerProps.gridOptions.paginationPageSize).toBe(20)
    })

    it('passes column definitions from schema', () => {
      expect(capturedGridViewerProps.columnDefs).toBeDefined()
      expect(vi.mocked(auditLogColDefs)).toHaveBeenCalledWith(mockT)
    })
  })

  describe('Pagination State Management', () => {
    it('initializes with correct pagination options', () => {
      render(<AuditLog />)
      
      expect(capturedGridViewerProps.paginationOptions).toEqual({
        page: 1,
        size: 10,
        sortOrders: defaultAuditLogSortModel,
        filters: []
      })
    })

    it('updates pagination options when onPaginationChange is called', async () => {
      render(<AuditLog />)
      
      await act(async () => {
        capturedGridViewerProps.onPaginationChange({ 
          page: 2, 
          size: 25,
          filters: [{ field: 'test', value: 'value' }]
        })
      })

      // Should merge with existing state
      expect(vi.mocked(useAuditLogs)).toHaveBeenCalledWith(
        {
          page: 2,
          size: 25,
          sortOrders: defaultAuditLogSortModel,
          filters: [{ field: 'test', value: 'value' }]
        },
        expect.any(Object)
      )
    })
  })
})