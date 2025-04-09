import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FuelSupplyChangelog } from '../FuelSupplyChangelog'
import { wrapper } from '@/tests/utils/wrapper'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useGetComplianceReport,
  useGetChangeLog
} from '@/hooks/useComplianceReports'
import { useParams, useSearchParams } from 'react-router-dom'

// Mock Loading component
vi.mock('@/components/Loading', () => ({
  default: () => <div>Loading...</div>
}))

// Mock BCDataGridServer component
vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  default: ({ apiData }) => (
    <div data-test={`grid-${apiData}`}>Grid Component</div>
  )
}))

// Mock BCTypography component
vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => <div {...props}>{children}</div>
}))

// Mock the hooks
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn()
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useGetComplianceReport: vi.fn(),
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

describe('FuelSupplyChangelog', () => {
  beforeEach(() => {
    // Setup mock return values
    useCurrentUser.mockReturnValue({
      data: {
        organization: {
          organizationId: 1
        }
      }
    })

    useGetComplianceReport.mockReturnValue({
      data: {
        report: {
          nickname: 'Test Report'
        },
        chain: []
      },
      isLoading: false
    })
    useGetChangeLog.mockReturnValue({
      data: [{ nickname: 'Test Report', fuelSupplies: [] }],
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

  it('should render both data grids', () => {
    render(<FuelSupplyChangelog />, { wrapper })

    // Debug the rendered output
    screen.debug()

    // Check if both grid components are rendered
    expect(screen.getByTestId('bc-grid-container')).toBeInTheDocument()
  })

  it('should display report nickname', () => {
    render(<FuelSupplyChangelog />, { wrapper })
    expect(screen.getByText('Test Report')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    useGetComplianceReport.mockReturnValue({
      data: null,
      isLoading: true
    })
    useGetChangeLog.mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<FuelSupplyChangelog />, { wrapper })
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should handle latest assessed report', () => {
    useGetComplianceReport.mockReturnValue({
      data: {
        report: {
          complianceReportGroupUuid: 'uuid'
        }
      },
      isLoading: false
    })
    useGetChangeLog.mockReturnValue({
      data: [{ nickname: 'Test Report', fuelSupplies: [{}] }],
      isLoading: false
    })

    render(<FuelSupplyChangelog />, { wrapper })

    // Both grids should be rendered
    expect(screen.getByTestId('bc-grid-container')).toBeInTheDocument()
  })
})
