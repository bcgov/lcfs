import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FinalSupplyEquipmentSummary } from '../FinalSupplyEquipmentSummary'
import { wrapper } from '@/tests/utils/wrapper'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// -------- mocks -------- //
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ complianceReportId: 'test-123' })
  }
})

let gridViewerProps
vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: (props) => {
    gridViewerProps = props
    return <div data-test="bc-grid-viewer" />
  }
}))

const mockFinalSupplyEquipmentSummaryColDefs = vi.hoisted(() =>
  vi.fn(() => [
    { field: 'organizationName', headerName: 'Organization' },
    { field: 'serialNbr', headerName: 'Serial Number' }
  ])
)

vi.mock('@/views/FinalSupplyEquipments/_schema.jsx', () => ({
  finalSupplyEquipmentSummaryColDefs: mockFinalSupplyEquipmentSummaryColDefs
}))

const mockUseCurrentUser = vi.fn()
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser()
}))

vi.mock('@/utils/grid/cellRenderers', () => ({
  LinkRenderer: () => <span data-test="link-renderer" />
}))

const mockUseGetFSEReportingList = vi.fn()
vi.mock('@/hooks/useFinalSupplyEquipment', () => ({
  useGetFSEReportingList: (...args) => mockUseGetFSEReportingList(...args)
}))

vi.mock('../GeoMapping', () => ({
  default: ({ complianceReportId }) => (
    <div data-test="geo-mapping" data-compliance-report-id={complianceReportId} />
  )
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => <div data-test="bc-box" {...props}>{children}</div>
}))

vi.mock('@mui/material/Grid2', () => ({
  default: ({ children, ...props }) => <div data-test="grid2" {...props}>{children}</div>
}))

vi.mock('@mui/material/FormControlLabel', () => ({
  default: ({ control, label, ...props }) => (
    <label data-test="form-control-label" {...props}>
      {control}
      {label}
    </label>
  )
}))

vi.mock('@mui/material/Switch', () => ({
  default: ({ checked, onChange, ...props }) => (
    <input
      data-test="switch"
      type="checkbox"
      checked={checked}
      onChange={onChange}
      role="checkbox"
      {...props}
    />
  )
}))

vi.mock('@/constants/schedules', () => ({
  defaultInitialPagination: { page: 1, size: 10 }
}))

// -------- test data -------- //
const mockEquipmentData = [
  {
    chargingEquipmentId: 1,
    organizationName: 'Test Org 1',
    serialNbr: 'SN001',
    location: 'Vancouver'
  },
  {
    chargingEquipmentId: 2,
    organizationName: 'Test Org 2',
    serialNbr: 'SN002',
    location: 'Victoria'
  },
  {
    chargingEquipmentId: 3,
    organizationName: 'Another Company',
    serialNbr: 'SN003',
    location: 'Surrey'
  }
]

const createQueryData = ({
  equipments = mockEquipmentData,
  pagination = {
    total: equipments.length,
    page: 1,
    size: 10
  },
  ...rest
} = {}) => ({
  data: {
    finalSupplyEquipments: equipments,
    pagination
  },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  ...rest
})

let hookCalls

// -------- helpers -------- //
const renderComponent = (props = {}) => {
  const defaultProps = {
    data: { finalSupplyEquipments: mockEquipmentData },
    status: COMPLIANCE_REPORT_STATUSES.DRAFT
  }
  return render(
    <FinalSupplyEquipmentSummary {...defaultProps} {...props} />,
    { wrapper }
  )
}

// -------- tests -------- //
describe('FinalSupplyEquipmentSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gridViewerProps = undefined
    hookCalls = []
    mockUseCurrentUser.mockReturnValue({
      hasAnyRole: () => false
    })
    mockUseGetFSEReportingList.mockImplementation((...args) => {
      hookCalls.push(args)
      return createQueryData()
    })
  })

  describe('Basic Rendering', () => {
    it('renders without data', () => {
      mockUseGetFSEReportingList.mockImplementation((...args) => {
        hookCalls.push(args)
        return createQueryData({
          equipments: [],
          pagination: { total: 0, page: 1, size: 10 }
        })
      })
      renderComponent({ data: null })
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('renders with data', () => {
      renderComponent()
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('form-control-label')).toBeInTheDocument()
      expect(screen.getByText('Show Map')).toBeInTheDocument()
      expect(
        mockFinalSupplyEquipmentSummaryColDefs
      ).toHaveBeenCalledWith(expect.any(Function), COMPLIANCE_REPORT_STATUSES.DRAFT, false)
    })

    it('renders with different status', () => {
      renderComponent({ status: COMPLIANCE_REPORT_STATUSES.SUBMITTED })
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  it('passes IDIR flag when current user has government role', () => {
    mockUseCurrentUser.mockReturnValue({
      hasAnyRole: () => true
    })
    renderComponent()
    expect(mockFinalSupplyEquipmentSummaryColDefs).toHaveBeenCalledWith(
      expect.any(Function),
      COMPLIANCE_REPORT_STATUSES.DRAFT,
      true
    )
  })

  describe('PaginatedData Logic', () => {
    it('handles no data scenario', () => {
      mockUseGetFSEReportingList.mockImplementation((...args) => {
        hookCalls.push(args)
        return createQueryData({
          equipments: [],
          pagination: { total: 0, page: 1, size: 10 }
        })
      })
      renderComponent({ data: null })
      const queryData = gridViewerProps.queryData
      expect(queryData.data.finalSupplyEquipments).toEqual([])
      expect(queryData.data.pagination.total).toBe(0)
      expect(queryData.isError).toBe(false)
      expect(queryData.isLoading).toBe(false)
    })

    it('handles undefined finalSupplyEquipments', () => {
      mockUseGetFSEReportingList.mockImplementation((...args) => {
        hookCalls.push(args)
        return {
          ...createQueryData({ equipments: [] }),
          data: {
            finalSupplyEquipments: undefined,
            pagination: { total: 0, page: 1, size: 10 }
          }
        }
      })
      renderComponent({ data: {} })
      const queryData = gridViewerProps.queryData
      expect(queryData.data.finalSupplyEquipments).toBeUndefined()
    })

    it('processes data without filters or sorts', () => {
      renderComponent()
      const queryData = gridViewerProps.queryData
      expect(queryData.data.finalSupplyEquipments).toHaveLength(3)
      expect(queryData.data.pagination.total).toBe(3)
      expect(queryData.data.pagination.page).toBe(1)
      expect(queryData.data.pagination.size).toBe(10)
    })

    it('applies contains filter correctly', async () => {
      renderComponent()

      // Simulate filter application through pagination change
      await act(async () => {
        gridViewerProps.onPaginationChange({
          filters: [{ field: 'organizationName', type: 'contains', filter: 'test' }]
        })
      })

      expect(mockUseGetFSEReportingList).toHaveBeenCalledTimes(2)
      const [, paginationOptions] = hookCalls.at(-1)
      expect(paginationOptions.filters).toEqual([
        { field: 'organizationName', type: 'contains', filter: 'test' }
      ])
    })

    it('handles multiple filters', async () => {
      renderComponent()

      await act(async () => {
        gridViewerProps.onPaginationChange({
          filters: [
            { field: 'organizationName', type: 'contains', filter: 'test' },
            { field: 'serialNbr', type: 'contains', filter: 'sn00' }
          ]
        })
      })

      expect(mockUseGetFSEReportingList).toHaveBeenCalledTimes(2)
      const [, paginationOptions] = hookCalls.at(-1)
      expect(paginationOptions.filters).toEqual([
        { field: 'organizationName', type: 'contains', filter: 'test' },
        { field: 'serialNbr', type: 'contains', filter: 'sn00' }
      ])
    })

    it('applies single sort order', async () => {
      renderComponent()

      await act(async () => {
        gridViewerProps.onPaginationChange({
          sortOrders: [{ field: 'organizationName', direction: 'asc' }]
        })
      })

      const [, paginationOptions] = hookCalls.at(-1)
      expect(paginationOptions.sortOrders).toEqual([
        { field: 'organizationName', direction: 'asc' }
      ])
    })

    it('applies descending sort order', async () => {
      renderComponent()

      await act(async () => {
        gridViewerProps.onPaginationChange({
          sortOrders: [{ field: 'organizationName', direction: 'desc' }]
        })
      })

      const [, paginationOptions] = hookCalls.at(-1)
      expect(paginationOptions.sortOrders).toEqual([
        { field: 'organizationName', direction: 'desc' }
      ])
    })

    it('handles pagination calculations', async () => {
      renderComponent()
      
      await act(async () => {
        gridViewerProps.onPaginationChange({
          page: 2,
          size: 10
        })
      })

      const [, paginationOptions] = hookCalls.at(-1)
      expect(paginationOptions.page).toBe(2)
      expect(paginationOptions.size).toBe(10)
    })
  })

  describe('UseMemo Hooks', () => {
    it('generates correct grid options', () => {
      renderComponent()
      const gridOptions = gridViewerProps.gridOptions
      expect(gridOptions.overlayNoRowsTemplate).toBe('finalSupplyEquipment:noFinalSupplyEquipmentsFound')
      expect(gridOptions.autoSizeStrategy.type).toBe('fitCellContents')
      expect(gridOptions.enableCellTextSelection).toBe(true)
      expect(gridOptions.ensureDomOrder).toBe(true)
    })

    it('generates defaultColDef for DRAFT status', () => {
      renderComponent({ status: COMPLIANCE_REPORT_STATUSES.DRAFT })
      const defaultColDef = gridViewerProps.defaultColDef
      expect(defaultColDef.floatingFilter).toBe(false)
      expect(defaultColDef.filter).toBe(false)
      expect(defaultColDef.cellRenderer).toBeDefined()
      expect(defaultColDef.cellRendererParams.url()).toBe('final-supply-equipments')
    })

    it('generates defaultColDef for non-DRAFT status', () => {
      renderComponent({ status: COMPLIANCE_REPORT_STATUSES.SUBMITTED })
      const defaultColDef = gridViewerProps.defaultColDef
      expect(defaultColDef.cellRenderer).toBeUndefined()
    })

    it('generates columns using schema function', () => {
      renderComponent()
      expect(gridViewerProps.columnDefs).toHaveLength(2)
      expect(gridViewerProps.columnDefs[0]).toHaveProperty('field', 'organizationName')
      expect(gridViewerProps.columnDefs[1]).toHaveProperty('field', 'serialNbr')
    })
  })

  describe('Event Handlers and Functions', () => {
    it('getRowId function works correctly', () => {
      renderComponent()
      const getRowId = gridViewerProps.getRowId
      const result = getRowId({ data: { chargingEquipmentId: 42 } })
      expect(result).toBe('42')
    })

    it('handles pagination change', async () => {
      renderComponent()
      expect(typeof gridViewerProps.onPaginationChange).toBe('function')
      
      await act(async () => {
        gridViewerProps.onPaginationChange({ page: 2, size: 5 })
      })

      expect(gridViewerProps.paginationOptions.page).toBe(2)
      expect(gridViewerProps.paginationOptions.size).toBe(5)
    })

    it('toggles map visibility', async () => {
      const user = userEvent.setup()
      renderComponent()

      expect(screen.queryByTestId('geo-mapping')).not.toBeInTheDocument()
      expect(screen.getByText('Show Map')).toBeInTheDocument()

      const switchEl = screen.getByRole('checkbox')
      await user.click(switchEl)

      expect(screen.getByTestId('geo-mapping')).toBeInTheDocument()
      expect(screen.getByText('Hide Map')).toBeInTheDocument()
    })
  })

  describe('Conditional Rendering', () => {
    it('shows map when switch is toggled', async () => {
      const user = userEvent.setup()
      renderComponent()

      await user.click(screen.getByRole('checkbox'))
      
      const geoMapping = screen.getByTestId('geo-mapping')
      expect(geoMapping).toBeInTheDocument()
      expect(geoMapping).toHaveAttribute('data-compliance-report-id', 'test-123')
    })

    it('calculates grid suppression correctly', () => {
      renderComponent()
      expect(gridViewerProps.suppressPagination).toBe(true)

      mockUseGetFSEReportingList.mockImplementation((...args) => {
        hookCalls.push(args)
        const largeData = Array.from({ length: 15 }, (_, i) => ({
          chargingEquipmentId: i + 1,
          organizationName: `Org ${i + 1}`,
          serialNbr: `SN${i + 1}`
        }))
        return createQueryData({
          equipments: largeData,
          pagination: { total: largeData.length, page: 1, size: 10 }
        })
      })

      renderComponent({ data: { finalSupplyEquipments: [] } })
      expect(gridViewerProps.suppressPagination).toBe(false)
    })

    it('handles missing data for suppression calculation', () => {
      mockUseGetFSEReportingList.mockImplementation((...args) => {
        hookCalls.push(args)
        return {
          ...createQueryData({ equipments: [] }),
          data: null
        }
      })

      renderComponent({ data: null })
      expect(gridViewerProps.suppressPagination).toBe(true)
    })
  })

  describe('Integration Tests', () => {
    it('combines filter and sort operations', async () => {
      renderComponent()
      
      await act(async () => {
        gridViewerProps.onPaginationChange({
          filters: [{ field: 'organizationName', type: 'contains', filter: 'test' }],
          sortOrders: [{ field: 'serialNbr', direction: 'desc' }]
        })
      })

      const [, paginationOptions] = hookCalls.at(-1)
      expect(paginationOptions.filters).toEqual([
        { field: 'organizationName', type: 'contains', filter: 'test' }
      ])
      expect(paginationOptions.sortOrders).toEqual([
        { field: 'serialNbr', direction: 'desc' }
      ])
    })

    it('handles empty filter strings', async () => {
      renderComponent()
      
      await act(async () => {
        gridViewerProps.onPaginationChange({
          filters: [{ field: 'organizationName', type: 'contains', filter: '' }]
        })
      })

      const [, paginationOptions] = hookCalls.at(-1)
      expect(paginationOptions.filters).toEqual([
        { field: 'organizationName', type: 'contains', filter: '' }
      ])
    })

    it('passes all required props to BCGridViewer', () => {
      renderComponent()
      
      expect(gridViewerProps.gridKey).toBe('final-supply-equipments')
      expect(gridViewerProps.dataKey).toBe('finalSupplyEquipments')
      expect(gridViewerProps.enableCopyButton).toBe(false)
      expect(gridViewerProps.enablePageCaching).toBe(false)
      expect(typeof gridViewerProps.gridRef).toBe('object')
      expect(Array.isArray(gridViewerProps.columnDefs)).toBe(true)
      expect(typeof gridViewerProps.queryData).toBe('object')
      expect(typeof gridViewerProps.getRowId).toBe('function')
      expect(typeof gridViewerProps.gridOptions).toBe('object')
      expect(typeof gridViewerProps.defaultColDef).toBe('object')
      expect(typeof gridViewerProps.onPaginationChange).toBe('function')
    })
  })
})
