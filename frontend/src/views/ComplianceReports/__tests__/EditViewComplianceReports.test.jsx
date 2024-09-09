import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import { EditViewComplianceReport } from '../EditViewComplianceReport'
import * as useComplianceReportsHook from '@/hooks/useComplianceReports'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import * as useOrganizationHook from '@/hooks/useOrganization'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// Custom render function with providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

// Mock react-router-dom
const mockUseParams = vi.fn()
const mockUseLocation = vi.fn()
const mockUseNavigate = vi.fn()
const mockHasRoles = vi.fn()

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useParams: () => mockUseParams(),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/hooks/useComplianceReports')
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')

vi.mock('../components/ActivityLinkList', () => ({
  ActivityLinksList: () => <div>Activity Links List</div>
}))

vi.mock('../components/ReportDetails', () => ({
  default: () => <div>Report Details</div>
}))

vi.mock('../components/ComplianceReportSummary', () => ({
  default: () => <div>Compliance Report Summary</div>
}))

vi.mock('../components/Introduction', () => ({
  Introduction: () => <div>Introduction</div>
}))

describe('EditViewComplianceReport', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    mockUseParams.mockReturnValue({
      compliancePeriod: '2023',
      complianceReportId: '123'
    })
    mockUseLocation.mockReturnValue({ state: {} })

    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      data: { organization: { organizationId: '123' } },
      isLoading: false,
      hasRoles: mockHasRoles
    })

    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue({
      data: { data: { organizationId: '123' } },
      isLoading: false,
      isError: false
    })

    vi.mocked(
      useComplianceReportsHook.useGetComplianceReportSummary
    ).mockReturnValue({
      data: {
        renewableFuelTargetSummary: [],
        lowCarbonFuelTargetSummary: [],
        nonCompliancePenaltySummary: []
      },
      isLoading: false,
      isError: false
    })

    vi.mocked(
      useComplianceReportsHook.useUpdateComplianceReport
    ).mockReturnValue({ mutate: {} })

    vi.mocked(useOrganizationHook.useOrganization).mockReturnValue({
      data: {
        name: 'Test Org',
        orgAddress: {
          addressLine1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345'
        },
        orgAttorneyAddress: {
          addressLine1: '456 Law St',
          city: 'Law City',
          state: 'LS',
          postalCode: '67890'
        }
      },
      isLoading: false
    })

    mockHasRoles.mockReturnValue(false)
  })

  it('renders the component', async () => {
    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(
        screen.getByText('2023 report:complianceReport')
      ).toBeInTheDocument()
    })
  })

  it('displays organization information', async () => {
    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('Test Org')).toBeInTheDocument()
      expect(screen.getByText('report:serviceAddrLabel:')).toBeInTheDocument()
      expect(screen.getByText('report:bcAddrLabel:')).toBeInTheDocument()
    })
  })

  it('renders report components', async () => {
    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('Report Details')).toBeInTheDocument()
      expect(screen.getByText('Compliance Report Summary')).toBeInTheDocument()
      expect(screen.getByText('Introduction')).toBeInTheDocument()
    })
  })

  it('displays an alert message when location state has a message', async () => {
    mockUseLocation.mockReturnValue({
      state: { message: 'Test alert', severity: 'success' }
    })

    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('Test alert')).toBeInTheDocument()
    })
  })

  it('displays an error message when there is an error fetching the report', async () => {
    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue({
      isError: true,
      error: { message: 'Error fetching report' }
    })

    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('Error fetching report')).toBeInTheDocument()
    })
  })

  it('displays the correct buttons for Draft status', async () => {
    mockHasRoles.mockReturnValue(true)

    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue({
      data: { data: { currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT } } },
      isLoading: false,
      isError: false
    })

    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('report:actionBtns.saveDraftBtn')).toBeInTheDocument()
      expect(screen.getByText('report:actionBtns.submitReportBtn')).toBeInTheDocument()
    })
  })

  it('displays the correct buttons for Submitted status with Analyst role', async () => {
    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue({
      data: { data: { currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED } } },
      isLoading: false,
      isError: false
    })

    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      data: { 
        organization: { organizationId: '123' },
        isGovernmentUser: true
      },
      isLoading: false,
      hasRoles: mockHasRoles
    })

    mockHasRoles.mockImplementation((role) => role === 'Analyst')

    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('report:actionBtns.recommendReportAnalystBtn')).toBeInTheDocument()
    })
  })

  it('displays the correct buttons for Recommended by Analyst status with Compliance Manager role', async () => {
    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue({
      data: { data: { currentStatus: { status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST } } },
      isLoading: false,
      isError: false
    })

    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      data: { 
        organization: { organizationId: '123' },
        isGovernmentUser: true
      },
      isLoading: false,
      hasRoles: (role) => role === 'Compliance Manager'
    })

    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('report:actionBtns.recommendReportManagerBtn')).toBeInTheDocument()
    })
  })

  it('displays the correct buttons for Recommended by Manager status with Director role', async () => {
    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue({
      data: { data: { currentStatus: { status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER } } },
      isLoading: false,
      isError: false
    })

    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      data: { 
        organization: { organizationId: '123' },
        isGovernmentUser: true
      },
      isLoading: false,
      hasRoles: (role) => role === 'Director'
    })

    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('report:actionBtns.assessReportBtn')).toBeInTheDocument()
    })
  })

  it('displays the correct buttons for Assessed status with Analyst role', async () => {
    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue({
      data: { data: { currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED } } },
      isLoading: false,
      isError: false
    })

    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      data: { 
        organization: { organizationId: '123' },
        isGovernmentUser: true
      },
      isLoading: false,
      hasRoles: (role) => role === 'Analyst'
    })

    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('report:actionBtns.reAssessReportBtn')).toBeInTheDocument()
    })
  })

  it('does not display action buttons for non-government users on submitted reports', async () => {
    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue({
      data: { data: { currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED } } },
      isLoading: false,
      isError: false
    })

    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      data: { 
        organization: { organizationId: '123' },
        isGovernmentUser: false
      },
      isLoading: false,
      hasRoles: () => false
    })

    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.queryByText('report:actionBtns.recommendReportAnalystBtn')).not.toBeInTheDocument()
      expect(screen.queryByText('report:actionBtns.recommendReportManagerBtn')).not.toBeInTheDocument()
      expect(screen.queryByText('report:actionBtns.assessReportBtn')).not.toBeInTheDocument()
      expect(screen.queryByText('report:actionBtns.reAssessReportBtn')).not.toBeInTheDocument()
    })
  })

  it('disables submit button when signing authority declaration is not checked', async () => {
    mockHasRoles.mockReturnValue(true)
    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue({
      data: { data: { currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT } } },
      isLoading: false,
      isError: false
    })
    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      const submitButton = screen.getByText('report:actionBtns.submitReportBtn')
      expect(submitButton).toBeDisabled()
    })
  })
})
