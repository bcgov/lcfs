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

// Custom render function with providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

// Mock react-router-dom
const mockUseParams = vi.fn()
const mockUseLocation = vi.fn()
const mockUseNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useParams: () => mockUseParams(),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}))

vi.mock('@/hooks/useComplianceReports')
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')

vi.mock('../components/ActivityLinkList', () => ({
  ActivityLinksList: () => <div>Activity Links List</div>,
}))

vi.mock('../components/ReportDetailsAccordion', () => ({
  default: () => <div>Report Details Accordion</div>,
}))

vi.mock('../components/ComplianceReportSummary', () => ({
  default: () => <div>Compliance Report Summary</div>,
}))

vi.mock('../components/Introduction', () => ({
  Introduction: () => <div>Introduction</div>,
}))

describe('EditViewComplianceReport', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Set up default mock return values
    mockUseParams.mockReturnValue({ compliancePeriod: '2023', complianceReportId: '123' })
    mockUseLocation.mockReturnValue({ state: {} })

    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      data: { organization: { organizationId: '123' } },
      isLoading: false,
    })

    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue({
      data: { data: { organizationId: '123' } },
      isLoading: false,
      isError: false,
    })

    vi.mocked(useComplianceReportsHook.useGetComplianceReportSummary).mockReturnValue({
      data: {
        renewableFuelTargetSummary: [],
        lowCarbonFuelTargetSummary: [],
        nonCompliancePenaltySummary: [],
      },
      isLoading: false,
      isError: false,
    })

    vi.mocked(useOrganizationHook.useOrganization).mockReturnValue({
      data: {
        name: 'Test Org',
        orgAddress: { addressLine1: '123 Test St', city: 'Test City', state: 'TS', postalCode: '12345' },
        orgAttorneyAddress: { addressLine1: '456 Law St', city: 'Law City', state: 'LS', postalCode: '67890' },
      },
      isLoading: false,
    })
  })

  it('renders the component', async () => {
    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('2023 report:complianceReport')).toBeInTheDocument()
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

  it('renders activity links and upload box', async () => {
    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('Activity Links List')).toBeInTheDocument()
      expect(screen.getByText('report:uploadLabel')).toBeInTheDocument()
    })
  })

  it('renders report components', async () => {
    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('Report Details Accordion')).toBeInTheDocument()
      expect(screen.getByText('Compliance Report Summary')).toBeInTheDocument()
      expect(screen.getByText('Introduction')).toBeInTheDocument()
    })
  })

  it('displays an alert message when location state has a message', async () => {
    mockUseLocation.mockReturnValue({ state: { message: 'Test alert', severity: 'success' } })

    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('Test alert')).toBeInTheDocument()
    })
  })

  it('displays an error message when there is an error fetching the report', async () => {
    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue({
      isError: true,
      error: { message: 'Error fetching report' },
    })

    customRender(<EditViewComplianceReport />)
    await waitFor(() => {
      expect(screen.getByText('Error fetching report')).toBeInTheDocument()
    })
  })
})