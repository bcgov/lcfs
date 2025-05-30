import React from 'react'
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditViewComplianceReport } from '../EditViewComplianceReport'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import * as useOrganizationHook from '@/hooks/useOrganization'
import * as useComplianceReportsHook from '@/hooks/useComplianceReports'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { wrapper } from '@/tests/utils/wrapper'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useParams
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@react-keycloak/web', () => ({
  ReactKeycloakProvider: ({ children }) => children,
  useKeycloak: () => ({
    keycloak: {
      authenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn()
    },
    initialized: true
  })
}))

// Mock useApiService
vi.mock('@/services/useApiService', () => ({
  default: vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  })),
  useApiService: vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }))
}))

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

vi.mock('@/hooks/useComplianceReports', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useGetComplianceReport: vi.fn(),
    useUpdateComplianceReport: vi.fn(() => ({ mutate: vi.fn() })),
    useDeleteComplianceReport: vi.fn(() => ({ mutate: vi.fn() })),
    useCreateSupplementalReport: vi.fn(() => ({ mutate: vi.fn() })),
    useCreateAnalystAdjustment: vi.fn(() => ({ mutate: vi.fn() })),
    useCreateIdirSupplementalReport: vi.fn(() => ({ mutate: vi.fn() }))
  }
})

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')

vi.mock('../components/ActivityLinksList', () => ({
  ActivityLinksList: () => <div>Activity Links List</div>
}))

vi.mock('../components/ActivityListCard', () => ({
  ActivityListCard: () => <div>Activity Links List</div>
}))

vi.mock('../components/AssessmentCard', () => ({
  AssessmentCard: () => (
    <div>
      <div>report:assessment</div>
      <div>report:reportHistory</div>
      <div>report:complianceReportHistory.AssessedBy</div>
    </div>
  )
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

vi.mock('../components/AssessmentStatement', () => ({
  AssessmentStatement: () => <div>Assessment Statement</div>
}))

// Basic mock data structure
const mockReportBase = {
  complianceReportId: 102,
  compliancePeriod: { description: '2023' },
  organization: { organizationId: 1, name: 'Test Org' },
  nickname: 'Test Report 2023',
  version: 0,
  supplementalInitiator: null,
  hasSupplemental: false,
  history: [],
  currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT },
  reportingFrequency: 'Annual',
  complianceReportGroupUuid: 'some-uuid',
  createTimestamp: new Date().toISOString(),
  updateTimestamp: new Date().toISOString()
}

const defaultMockReportData = {
  report: mockReportBase,
  chain: [mockReportBase],
  isNewest: true
}

const queryClient = new QueryClient()

const renderComponent = (
  component,
  initialEntries = ['/compliance-reports/2023/102']
) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="/compliance-reports/:compliancePeriod/:complianceReportId"
          element={component}
        />
      </Routes>
    </MemoryRouter>,
    { wrapper }
  )
}

describe('EditViewComplianceReport', () => {
  const setupMocks = (overrides = {}) => {
    const defaultMocks = {
      useParams: { compliancePeriod: '2023', complianceReportId: '123' },
      useLocation: { state: {} },
      currentUser: {
        data: {
          organization: { organizationId: '123' },
          isGovernmentUser: false
        },
        isLoading: false,
        hasRoles: mockHasRoles,
        hasAnyRole: () => false
      },
      reportData: {
        report: {
          organizationId: '123',
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT },
          history: [],
          nickname: 'Test Report'
        },
        chain: []
      },
      isError: false,
      error: null,
      organization: {
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
      }
    }

    const mocks = { ...defaultMocks, ...overrides }

    mockUseParams.mockReturnValue(mocks.useParams)
    mockUseLocation.mockReturnValue(mocks.useLocation)
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue(
      mocks.currentUser
    )
    vi.mocked(useOrganizationHook.useOrganization).mockReturnValue(
      mocks.organization
    )
    vi.mocked(
      useComplianceReportsHook.useUpdateComplianceReport
    ).mockReturnValue({ mutate: vi.fn() })
    vi.mocked(
      useComplianceReportsHook.useDeleteComplianceReport
    ).mockReturnValue({ mutate: vi.fn() })
    vi.mocked(
      useComplianceReportsHook.useCreateAnalystAdjustment
    ).mockReturnValue({ mutate: vi.fn() })
    vi.mocked(
      useComplianceReportsHook.useCreateSupplementalReport
    ).mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })

    return mocks
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      data: { isGovernmentUser: false },
      hasRoles: () => false,
      hasAnyRole: () => true,
      isLoading: false
    })
    vi.mocked(useOrganizationHook.useOrganization).mockReturnValue({
      data: { name: 'Test Org' },
      isLoading: false
    })
    mockUseLocation.mockReturnValue({ state: null })
    mockUseParams.mockReturnValue({
      compliancePeriod: '2023',
      complianceReportId: '102'
    })

    // --- Key Fix: Ensure useGetComplianceReport returns the correct structure ---
    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue({
      data: defaultMockReportData, // Provide mock data
      isLoading: false,
      isError: false,
      error: null
    })

    // Reset mutation mocks if needed (example)
    const mockMutate = vi.fn()
    vi.mocked(
      useComplianceReportsHook.useUpdateComplianceReport
    ).mockReturnValue({ mutate: mockMutate })
    vi.mocked(
      useComplianceReportsHook.useDeleteComplianceReport
    ).mockReturnValue({ mutate: mockMutate })
    vi.mocked(
      useComplianceReportsHook.useCreateSupplementalReport
    ).mockReturnValue({ mutate: mockMutate })
    vi.mocked(
      useComplianceReportsHook.useCreateAnalystAdjustment
    ).mockReturnValue({ mutate: mockMutate })
    vi.mocked(
      useComplianceReportsHook.useCreateIdirSupplementalReport
    ).mockReturnValue({ mutate: mockMutate })
  })

  it('renders the component', async () => {
    const mocks = setupMocks()
    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(screen.getByText(/2023.*complianceReport/i)).toBeInTheDocument()
    })
  })

  it('renders report components', async () => {
    const mocks = setupMocks()
    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(screen.getByText('Report Details')).toBeInTheDocument()
      expect(screen.getByText('Compliance Report Summary')).toBeInTheDocument()
      expect(screen.getByText('Introduction')).toBeInTheDocument()
    })
  })

  it('displays an alert message when location state has a message', async () => {
    const mocks = setupMocks({
      useLocation: { state: { message: 'Test alert', severity: 'success' } }
    })
    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(screen.getByText('Test alert')).toBeInTheDocument()
    })
  })

  it('displays an error message when there is an error fetching the report', async () => {
    const mocks = setupMocks({
      isError: true,
      error: { message: 'Error fetching report' }
    })
    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(screen.getByText('Error fetching report')).toBeInTheDocument()
    })
  })

  it('displays the correct buttons for Submitted status with Analyst role', async () => {
    const mocks = setupMocks({
      reportData: {
        report: {
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
        },
        chain: []
      },
      currentUser: {
        data: { isGovernmentUser: true },
        hasRoles: (role) => role === 'Analyst',
        hasAnyRole: () => false
      }
    })
    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(
        screen.getByText('report:actionBtns.recommendReportAnalystBtn')
      ).toBeInTheDocument()
    })
  })

  it('displays the correct buttons for Recommended by Analyst status with Compliance Manager role', async () => {
    const mocks = setupMocks({
      reportData: {
        report: {
          currentStatus: {
            status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
          }
        },
        chain: []
      },
      currentUser: {
        data: { isGovernmentUser: true },
        hasRoles: (role) => role === 'Compliance Manager',
        hasAnyRole: () => false
      }
    })
    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(
        screen.getByText('report:actionBtns.recommendReportManagerBtn')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:actionBtns.returnToAnalyst')
      ).toBeInTheDocument()
    })
  })

  it('displays the correct buttons for Recommended by Manager status with Director role', async () => {
    const mocks = setupMocks({
      reportData: {
        report: {
          currentStatus: {
            status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
          }
        },
        chain: []
      },
      currentUser: {
        data: { isGovernmentUser: true },
        hasRoles: (role) => role === 'Director',
        hasAnyRole: () => false
      }
    })
    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(
        screen.getByText('report:actionBtns.assessReportBtn')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:actionBtns.returnToManager')
      ).toBeInTheDocument()
    })
  })

  it('does not display action buttons for non-government users on submitted reports', async () => {
    const mocks = setupMocks({
      reportData: {
        report: {
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
        },
        chain: []
      },
      currentUser: {
        data: { isGovernmentUser: false },
        hasRoles: () => false,
        hasAnyRole: () => false
      }
    })
    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(
        screen.queryByText('report:actionBtns.recommendReportAnalystBtn')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('report:actionBtns.recommendReportManagerBtn')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('report:actionBtns.assessReportBtn')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('report:actionBtns.reAssessReportBtn')
      ).not.toBeInTheDocument()
    })
  })

  it('displays internal comments section for government users', async () => {
    const mocks = setupMocks({
      currentUser: {
        data: { isGovernmentUser: true },
        hasRoles: () => true,
        hasAnyRole: () => false
      }
    })
    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(screen.getByText('report:internalComments')).toBeInTheDocument()
    })
  })

  it('does not display internal comments section for non-government users', async () => {
    const mocks = setupMocks({
      currentUser: {
        data: { isGovernmentUser: false },
        hasRoles: () => false,
        hasAnyRole: () => false
      }
    })
    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(
        screen.queryByText('report:internalComments')
      ).not.toBeInTheDocument()
    })
  })

  it('displays ActivityListCard for Draft status', async () => {
    const mocks = setupMocks({
      reportData: {
        report: {
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT }
        },
        chain: []
      },
      currentUser: {
        data: {
          organization: { organizationId: '123' },
          isGovernmentUser: false
        },
        isLoading: false,
        hasRoles: mockHasRoles,
        hasAnyRole: () => true
      }
    })
    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(screen.getByText('Activity Links List')).toBeInTheDocument()
    })
  })

  it('displays AssessmentCard with history and correct status filtering', async () => {
    const historyMock = [
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
        createDate: '2024-10-01',
        userProfile: { firstName: 'John', lastName: 'Doe' }
      },
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
        createDate: '2024-09-20',
        userProfile: { firstName: 'Jane', lastName: 'Smith' }
      }
    ]

    const mocks = setupMocks({
      reportData: {
        report: {
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
          history: historyMock
        },
        chain: [
          {
            history: historyMock,
            version: 0,
            compliancePeriod: {
              description: '2024'
            },
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
          }
        ]
      }
    })

    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(screen.getByText('report:assessment')).toBeInTheDocument()
      expect(screen.getByText('report:reportHistory')).toBeInTheDocument()
      expect(
        screen.getByText('report:complianceReportHistory.AssessedBy')
      ).toBeInTheDocument()
    })
  })

  it('displays scroll-to-top button when scrolling down', async () => {
    const mocks = setupMocks()
    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      fireEvent.scroll(window, { target: { pageYOffset: 100 } })
      expect(screen.getByLabelText('scroll to bottom')).toBeInTheDocument()
    })
  })

  it('displays scroll-to-bottom button when at the top of the page', async () => {
    const mocks = setupMocks()
    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )
    await waitFor(() => {
      fireEvent.scroll(window, { target: { pageYOffset: 0 } })
      expect(screen.getByLabelText('scroll to bottom')).toBeInTheDocument()
    })
  })

  it('should show Assessment Recommendation section for government users (IDIR)', async () => {
    const mocks = setupMocks({
      currentUser: {
        data: {
          organization: { organizationId: '123' },
          isGovernmentUser: true, // Government user (IDIR)
          roles: ['analyst'] // Government role
        },
        isLoading: false,
        hasRoles: (roles) => roles.includes('analyst'),
        hasAnyRole: () => true
      }
    })

    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )

    await waitFor(() => {
      // Check for Assessment Recommendation heading
      expect(screen.getByText(/assessmentRecommendation/i)).toBeInTheDocument()
      // Check for Internal Comments section (also within the government-only section)
      expect(screen.getByText(/internalComments/i)).toBeInTheDocument()
    })
  })

  it('should hide Assessment Recommendation section for non-government users (BCeID)', async () => {
    const mocks = setupMocks({
      currentUser: {
        data: {
          organization: { organizationId: '123' },
          isGovernmentUser: false, // Non-government user (BCeID)
          roles: ['supplier'] // Non-government role
        },
        isLoading: false,
        hasRoles: (roles) => roles.includes('supplier'),
        hasAnyRole: () => false
      }
    })

    render(
      <EditViewComplianceReport
        reportData={mocks.reportData}
        isError={mocks.isError}
        error={mocks.error}
      />,
      { wrapper }
    )

    await waitFor(() => {
      // Assessment Recommendation heading should NOT be present
      expect(
        screen.queryByText(/assessmentRecommendation/i)
      ).not.toBeInTheDocument()
      // Internal Comments section should NOT be present
      expect(screen.queryByText(/internalComments/i)).not.toBeInTheDocument()
    })
  })
})
