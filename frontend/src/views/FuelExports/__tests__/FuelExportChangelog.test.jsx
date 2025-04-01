import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FuelExportChangelog } from '../FuelExportChangelog'
import { wrapper } from '@/tests/utils/wrapper'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useParams } from 'react-router-dom'

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
  useGetComplianceReport: vi.fn()
}))

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useParams: vi.fn()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en' }
  })
}))

describe('FuelExportChangelog', () => {
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

    useParams.mockReturnValue({
      complianceReportId: '123',
      compliancePeriod: '2023'
    })
  })

  it('should render both data grids', () => {
    render(<FuelExportChangelog />, { wrapper })

    // Debug the rendered output
    screen.debug()

    // Check if both grid components are rendered
    expect(screen.getByTestId('grid-changelog')).toBeInTheDocument()
    expect(screen.getByTestId('grid-fuelExports')).toBeInTheDocument()
  })

  it('should display report nickname when not editable', () => {
    render(<FuelExportChangelog canEdit={false} />, { wrapper })
    expect(screen.getByText('Test Report')).toBeInTheDocument()
  })

  it('should display current state text when editable', () => {
    render(<FuelExportChangelog canEdit={true} />, { wrapper })
    expect(screen.getByText('common:changelogCurrentState')).toBeInTheDocument()
  })

  it('should display compliance period and report assessed text', () => {
    render(<FuelExportChangelog />, { wrapper })
    expect(screen.getByText('2023 report:reportAssessed')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    useGetComplianceReport.mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<FuelExportChangelog />, { wrapper })
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should handle latest assessed report', () => {
    useGetComplianceReport.mockReturnValue({
      data: {
        report: {
          nickname: 'Test Report'
        },
        chain: [
          {
            complianceReportId: '456',
            version: 1,
            currentStatus: {
              status: 'Assessed'
            }
          },
          {
            complianceReportId: '789',
            version: 2,
            currentStatus: {
              status: 'Assessed'
            }
          }
        ]
      },
      isLoading: false
    })

    render(<FuelExportChangelog />, { wrapper })

    // Both grids should be rendered
    expect(screen.getByTestId('grid-changelog')).toBeInTheDocument()
    expect(screen.getByTestId('grid-fuelExports')).toBeInTheDocument()
  })
})
