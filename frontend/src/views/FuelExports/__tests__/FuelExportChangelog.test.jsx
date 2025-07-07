import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FuelExportChangelog } from '../FuelExportChangelog'
import { wrapper } from '@/tests/utils/wrapper'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useComplianceReportWithCache,
  useGetChangeLog
} from '@/hooks/useComplianceReports'
import { useParams, useSearchParams } from 'react-router-dom'

// Mock Loading component
vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading">Loading...</div>
}))

// Mock BCGridViewer component
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: ({ gridKey, queryData }) => (
    <div data-test="bc-grid-container">
      <div data-test="grid-key">{gridKey}</div>
      <div data-test="grid-data">
        {JSON.stringify(queryData?.data?.items || [])}
      </div>
    </div>
  )
}))

// Mock BCTypography component
vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => <div {...props}>{children}</div>
}))

// Mock schema
vi.mock('./_schema', () => ({
  changelogColDefs: () => [
    { field: 'fuelType', headerName: 'Fuel Type' },
    { field: 'actionType', headerName: 'Action' }
  ],
  changelogCommonColDefs: (highlight) => [
    { field: 'fuelType', headerName: 'Fuel Type' },
    { field: 'quantity', headerName: 'Quantity' }
  ]
}))

// Mock constants
vi.mock('@/constants/schedules.js', () => ({
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

// Mock the hooks
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn()
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: vi.fn(),
  useGetChangeLog: vi.fn()
}))

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useParams: vi.fn(),
  useSearchParams: vi.fn()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en' }
  })
}))

describe('FuelExportChangelog', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Setup mock return values
    useCurrentUser.mockReturnValue({
      data: {
        organization: {
          organizationId: 1
        }
      }
    })

    useComplianceReportWithCache.mockReturnValue({
      data: {
        report: {
          complianceReportGroupUuid: 'test-group-uuid'
        }
      },
      isLoading: false
    })

    useGetChangeLog.mockReturnValue({
      data: [{ nickname: 'Test Report', fuelExports: [] }],
      isLoading: false
    })

    useParams.mockReturnValue({
      complianceReportId: '123'
    })
    useSearchParams.mockReturnValue([
      new URLSearchParams(),
      vi.fn(() => new URLSearchParams())
    ])
  })

  it('should render changelog grid when data is available', () => {
    render(<FuelExportChangelog />, { wrapper })

    // Check if grid component is rendered
    expect(screen.getByTestId('bc-grid-container')).toBeInTheDocument()
    expect(screen.getByTestId('grid-key')).toHaveTextContent(
      'fuel-exports-changelog-0'
    )
  })

  it('should display report nickname', () => {
    render(<FuelExportChangelog />, { wrapper })
    expect(screen.getByText('Test Report')).toBeInTheDocument()
  })

  it('should show loading state', () => {
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

  it('should handle changelog data with fuel exports', () => {
    useGetChangeLog.mockReturnValue({
      data: [
        {
          nickname: 'Test Report',
          fuelExports: [
            { fuelExportId: 1, fuelType: 'Diesel', actionType: 'CREATE' }
          ]
        }
      ],
      isLoading: false
    })

    render(<FuelExportChangelog />, { wrapper })

    // Grid should be rendered with data
    expect(screen.getByTestId('bc-grid-container')).toBeInTheDocument()
    expect(screen.getByText('Test Report')).toBeInTheDocument()
    // Check that grid data contains the expected data
    const gridData = screen.getByTestId('grid-data')
    expect(gridData).toHaveTextContent('"fuelExportId":1')
    expect(gridData).toHaveTextContent('"fuelType":"Diesel"')
  })
})
