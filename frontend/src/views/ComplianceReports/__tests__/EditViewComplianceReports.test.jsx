import React from 'react'
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditViewComplianceReport } from '../EditViewComplianceReport'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import * as useOrganizationHook from '@/hooks/useOrganization'
import * as useComplianceReportsHook from '@/hooks/useComplianceReports'
import useComplianceReportStore, {
  mockGetCachedReport
} from '@/stores/useComplianceReportStore'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { wrapper } from '@/tests/utils/wrapper'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

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

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    handleSubmit: (fn) => fn,
    reset: vi.fn(),
    setValue: vi.fn(),
    getValues: vi.fn(),
    watch: vi.fn(),
    control: {},
    formState: { errors: {} }
  })
}))

// Mock FontAwesome
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon, className }) => (
    <span className={className}>{icon}</span>
  )
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
vi.mock('@/stores/useComplianceReportStore', () => {
  const mockGetCachedReport = vi.fn()
  return {
    __esModule: true,
    default: vi.fn((selector) => {
      // Handle selector pattern: const reportData = useComplianceReportStore((state) => state.getCachedReport(id))
      if (selector && typeof selector === 'function') {
        return selector({ getCachedReport: mockGetCachedReport })
      }
      // Handle direct usage pattern
      return { getCachedReport: mockGetCachedReport }
    }),
    mockGetCachedReport
  }
})

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
  default: ({ buttonClusterConfig, currentStatus }) => {
    const COMPLIANCE_REPORT_STATUSES = {
      DRAFT: 'Draft'
    }

    return (
      <div>
        <div>Compliance Report Summary</div>
        {/* Only show buttons for DRAFT status, matching real component behavior */}
        {currentStatus === COMPLIANCE_REPORT_STATUSES.DRAFT &&
          buttonClusterConfig?.[currentStatus] &&
          buttonClusterConfig[currentStatus].map((button, index) => (
            <button key={index} type="button">
              {button.label}
            </button>
          ))}
      </div>
    )
  }
}))

vi.mock('../components/Introduction', () => ({
  Introduction: () => <div>Introduction</div>
}))

vi.mock('../components/AssessmentStatement', () => ({
  AssessmentStatement: () => <div>Assessment Statement</div>
}))

vi.mock('../components/AssessmentRecommendation', () => ({
  AssessmentRecommendation: () => <div>Assessment Recommendation</div>
}))

vi.mock('@/components/InternalComments', () => ({
  default: () => <div>Internal Comments</div>
}))

vi.mock('@/components/Role', () => ({
  Role: ({ children }) => <div>{children}</div>
}))

vi.mock('@/components/BCAlert', () => ({
  FloatingAlert: ({ ref, ...props }) => (
    <div data-testid="alert-box" {...props} />
  )
}))

vi.mock('@/utils/grid/cellEditables.jsx', () => ({
  isQuarterEditable: vi.fn(() => true)
}))

vi.mock('../components/ComplianceReportEarlyIssuanceSummary.jsx', () => ({
  default: () => <div>Early Issuance Summary</div>
}))

// Mock the button configs
vi.mock('../buttonConfigs', () => ({
  buttonClusterConfigFn: ({ currentUser, hasRoles }) => {
    const isAnalyst = hasRoles && hasRoles('Analyst')
    const isManager = hasRoles && hasRoles('Compliance Manager')
    const isDirector = hasRoles && hasRoles('Director')

    return {
      [COMPLIANCE_REPORT_STATUSES.SUBMITTED]: isAnalyst
        ? [
            {
              id: 'recommend-analyst-btn',
              label: 'report:actionBtns.recommendReportAnalystBtn',
              variant: 'contained',
              color: 'primary',
              handler: vi.fn()
            }
          ]
        : [],
      [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST]: isManager
        ? [
            {
              id: 'recommend-manager-btn',
              label: 'report:actionBtns.recommendReportManagerBtn',
              variant: 'contained',
              color: 'primary',
              handler: vi.fn()
            },
            {
              id: 'return-to-analyst-btn',
              label: 'report:actionBtns.returnToAnalyst',
              variant: 'outlined',
              color: 'primary',
              handler: vi.fn()
            }
          ]
        : [],
      [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER]: isDirector
        ? [
            {
              id: 'assess-report-btn',
              label: 'report:actionBtns.assessReportBtn',
              variant: 'contained',
              color: 'primary',
              handler: vi.fn()
            },
            {
              id: 'return-to-manager-btn',
              label: 'report:actionBtns.returnToManager',
              variant: 'outlined',
              color: 'primary',
              handler: vi.fn()
            }
          ]
        : [],
      [COMPLIANCE_REPORT_STATUSES.DRAFT]: []
    }
  }
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
  updateTimestamp: new Date().toISOString(),
  organizationId: '123'
}

const defaultMockReportData = {
  report: mockReportBase,
  chain: [mockReportBase],
  isNewest: true
}

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
        hasRoles: vi.fn(() => false),
        hasAnyRole: vi.fn(() => false)
      },
      reportData: {
        report: {
          organizationId: '123',
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT },
          history: [],
          nickname: 'Test Report',
          reportingFrequency: 'Annual'
        },
        chain: [],
        isNewest: true
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
    // Ensure the store mock returns the reportData when called
    mockGetCachedReport.mockReturnValue(mocks.reportData)
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
    vi.mocked(
      useComplianceReportsHook.useCreateIdirSupplementalReport
    ).mockReturnValue({ mutate: vi.fn() })

    return mocks
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      data: { isGovernmentUser: false },
      hasRoles: vi.fn(() => false),
      hasAnyRole: vi.fn(() => true),
      isLoading: false
    })
    vi.mocked(useOrganizationHook.useOrganization).mockReturnValue({
      data: { name: 'Test Org' },
      isLoading: false
    })
    mockGetCachedReport.mockReturnValue(defaultMockReportData)
    mockUseLocation.mockReturnValue({ state: null })
    mockUseParams.mockReturnValue({
      compliancePeriod: '2023',
      complianceReportId: '102'
    })

    // Reset mutation mocks
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
    render(<EditViewComplianceReport isError={false} error={null} />, {
      wrapper
    })
    await waitFor(() => {
      expect(
        screen.getAllByText(/2023.*complianceReport/i).length
      ).toBeGreaterThan(0)
    })
  })

  it('renders report components', async () => {
    const mocks = setupMocks()
    render(<EditViewComplianceReport isError={false} error={null} />, {
      wrapper
    })
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
    render(<EditViewComplianceReport isError={false} error={null} />, {
      wrapper
    })
    // The FloatingAlert component is mocked, so we just verify it's rendered
    await waitFor(() => {
      expect(screen.getByTestId('alert-box')).toBeInTheDocument()
    })
  })

  it('displays an error message when there is an error fetching the report', async () => {
    const mocks = setupMocks({
      isError: true,
      error: { message: 'Error fetching report' }
    })
    render(
      <EditViewComplianceReport
        isError={true}
        error={{ message: 'Error fetching report' }}
      />,
      {
        wrapper
      }
    )
    await waitFor(() => {
      expect(screen.getByText('report:errorRetrieving')).toBeInTheDocument()
    })
  })

  it('displays the correct buttons for Submitted status with Analyst role', async () => {
    const mocks = setupMocks({
      reportData: {
        report: {
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
          organizationId: '123',
          reportingFrequency: 'Annual'
        },
        chain: [],
        isNewest: true
      },
      currentUser: {
        data: { isGovernmentUser: true },
        hasRoles: vi.fn((role) => role === 'Analyst'),
        hasAnyRole: vi.fn(() => false),
        isLoading: false
      }
    })
    render(<EditViewComplianceReport isError={false} error={null} />, {
      wrapper
    })
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
          },
          organizationId: '123',
          reportingFrequency: 'Annual'
        },
        chain: [],
        isNewest: true
      },
      currentUser: {
        data: { isGovernmentUser: true },
        hasRoles: vi.fn((role) => role === 'Compliance Manager'),
        hasAnyRole: vi.fn(() => false),
        isLoading: false
      }
    })
    render(<EditViewComplianceReport isError={false} error={null} />, {
      wrapper
    })
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
          },
          organizationId: '123',
          reportingFrequency: 'Annual'
        },
        chain: [],
        isNewest: true
      },
      currentUser: {
        data: { isGovernmentUser: true },
        hasRoles: vi.fn((role) => role === 'Director'),
        hasAnyRole: vi.fn(() => false),
        isLoading: false
      }
    })
    render(<EditViewComplianceReport isError={false} error={null} />, {
      wrapper
    })
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
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
          organizationId: '123',
          reportingFrequency: 'Annual'
        },
        chain: [],
        isNewest: true
      },
      currentUser: {
        data: { isGovernmentUser: false },
        hasRoles: vi.fn(() => false),
        hasAnyRole: vi.fn(() => false),
        isLoading: false
      }
    })
    render(<EditViewComplianceReport isError={false} error={null} />, {
      wrapper
    })
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
        hasRoles: vi.fn(() => true),
        hasAnyRole: vi.fn(() => false),
        isLoading: false
      }
    })
    render(<EditViewComplianceReport isError={false} error={null} />, {
      wrapper
    })
    await waitFor(() => {
      expect(screen.getByText('report:internalComments')).toBeInTheDocument()
    })
  })

  it('does not display internal comments section for non-government users', async () => {
    const mocks = setupMocks({
      currentUser: {
        data: { isGovernmentUser: false },
        hasRoles: vi.fn(() => false),
        hasAnyRole: vi.fn(() => false),
        isLoading: false
      }
    })
    render(<EditViewComplianceReport isError={false} error={null} />, {
      wrapper
    })
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
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT },
          organizationId: '123',
          reportingFrequency: 'Annual'
        },
        chain: [],
        isNewest: true
      },
      currentUser: {
        data: {
          organization: { organizationId: '123' },
          isGovernmentUser: false
        },
        isLoading: false,
        hasRoles: vi.fn(() => false),
        hasAnyRole: vi.fn(() => true)
      }
    })
    render(<EditViewComplianceReport isError={false} error={null} />, {
      wrapper
    })
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
          history: historyMock,
          organizationId: '123',
          reportingFrequency: 'Annual'
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
        ],
        isNewest: true
      }
    })

    render(<EditViewComplianceReport isError={false} error={null} />, {
      wrapper
    })
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
    render(<EditViewComplianceReport isError={false} error={null} />, {
      wrapper
    })
    await waitFor(() => {
      fireEvent.scroll(window, { target: { pageYOffset: 100 } })
      expect(screen.getByLabelText('scroll to bottom')).toBeInTheDocument()
    })
  })

  it('displays scroll-to-bottom button when at the top of the page', async () => {
    const mocks = setupMocks()
    render(<EditViewComplianceReport isError={false} error={null} />, {
      wrapper
    })
    await waitFor(() => {
      fireEvent.scroll(window, { target: { pageYOffset: 0 } })
      expect(screen.getByLabelText('scroll to bottom')).toBeInTheDocument()
    })
  })

  describe('Assessment Section Visibility', () => {
    it('shows assessment section title and components for government users without draft supplemental', async () => {
      const mocks = setupMocks({
        currentUser: {
          data: { isGovernmentUser: true },
          hasRoles: vi.fn((role) => role === 'Analyst'),
          hasAnyRole: vi.fn(() => false),
          isLoading: false
        },
        reportData: {
          report: {
            organizationId: '123',
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
            history: [],
            nickname: 'Test Report',
            reportingFrequency: 'Annual' // Not quarterly
          },
          chain: [],
          isNewest: true // No draft supplemental
        }
      })

      render(<EditViewComplianceReport isError={false} error={null} />, {
        wrapper
      })

      await waitFor(() => {
        expect(
          screen.getByText('report:assessmentRecommendation')
        ).toBeInTheDocument()
        expect(screen.getByText('Assessment Statement')).toBeInTheDocument()
        expect(
          screen.getByText('Assessment Recommendation')
        ).toBeInTheDocument()
      })
    })

    it('hides assessment section title and components when draft supplemental exists', async () => {
      const mocks = setupMocks({
        currentUser: {
          data: { isGovernmentUser: true },
          hasRoles: vi.fn((role) => role === 'Analyst'),
          hasAnyRole: vi.fn(() => false),
          isLoading: false
        },
        reportData: {
          report: {
            organizationId: '123',
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
            history: [],
            nickname: 'Test Report',
            reportingFrequency: 'Annual'
          },
          chain: [],
          isNewest: false // Draft supplemental exists
        }
      })

      render(<EditViewComplianceReport isError={false} error={null} />, {
        wrapper
      })

      await waitFor(() => {
        expect(
          screen.queryByText('report:assessmentRecommendation')
        ).not.toBeInTheDocument()
        expect(
          screen.queryByText('Assessment Statement')
        ).not.toBeInTheDocument()
        expect(
          screen.queryByText('Assessment Recommendation')
        ).not.toBeInTheDocument()
      })
    })

    it('hides assessment section for quarterly reports', async () => {
      const mocks = setupMocks({
        currentUser: {
          data: { isGovernmentUser: true },
          hasRoles: vi.fn((role) => role === 'Analyst'),
          hasAnyRole: vi.fn(() => false),
          isLoading: false
        },
        reportData: {
          report: {
            organizationId: '123',
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
            history: [],
            nickname: 'Test Report',
            reportingFrequency: 'Quarterly' // Quarterly report
          },
          chain: [],
          isNewest: true
        }
      })

      render(<EditViewComplianceReport isError={false} error={null} />, {
        wrapper
      })

      await waitFor(() => {
        expect(
          screen.queryByText('report:assessmentRecommendation')
        ).not.toBeInTheDocument()
        expect(
          screen.queryByText('Assessment Statement')
        ).not.toBeInTheDocument()
        expect(
          screen.queryByText('Assessment Recommendation')
        ).not.toBeInTheDocument()
      })
    })

    it('hides assessment statement for non-government users', async () => {
      const mocks = setupMocks({
        currentUser: {
          data: { isGovernmentUser: false },
          hasRoles: vi.fn(() => false),
          hasAnyRole: vi.fn(() => false),
          isLoading: false
        },
        reportData: {
          report: {
            organizationId: '123',
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
            history: [],
            nickname: 'Test Report',
            reportingFrequency: 'Annual'
          },
          chain: [],
          isNewest: true
        }
      })

      render(<EditViewComplianceReport isError={false} error={null} />, {
        wrapper
      })

      await waitFor(() => {
        expect(
          screen.queryByText('Assessment Statement')
        ).not.toBeInTheDocument()
        // Section title should not show since no components are visible
        expect(
          screen.queryByText('report:assessmentRecommendation')
        ).not.toBeInTheDocument()
      })
    })

    it('shows assessment recommendation only for analysts', async () => {
      const mocks = setupMocks({
        currentUser: {
          data: { isGovernmentUser: true },
          hasRoles: vi.fn((role) => role === 'Director'), // Not analyst
          hasAnyRole: vi.fn(() => false),
          isLoading: false
        },
        reportData: {
          report: {
            organizationId: '123',
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
            history: [],
            nickname: 'Test Report',
            reportingFrequency: 'Annual'
          },
          chain: [],
          isNewest: true
        }
      })

      render(<EditViewComplianceReport isError={false} error={null} />, {
        wrapper
      })

      await waitFor(() => {
        // Should show assessment statement for government users
        expect(screen.getByText('Assessment Statement')).toBeInTheDocument()
        // Should not show assessment recommendation for non-analysts
        expect(
          screen.queryByText('Assessment Recommendation')
        ).not.toBeInTheDocument()
        // Should still show section title since assessment statement is visible
        expect(
          screen.getByText('report:assessmentRecommendation')
        ).toBeInTheDocument()
      })
    })

    it('shows both assessment components for government analyst users', async () => {
      const mocks = setupMocks({
        currentUser: {
          data: { isGovernmentUser: true },
          hasRoles: vi.fn((role) => role === 'Analyst'),
          hasAnyRole: vi.fn(() => false),
          isLoading: false
        },
        reportData: {
          report: {
            organizationId: '123',
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
            history: [],
            nickname: 'Test Report',
            reportingFrequency: 'Annual'
          },
          chain: [],
          isNewest: true
        }
      })

      render(<EditViewComplianceReport isError={false} error={null} />, {
        wrapper
      })

      await waitFor(() => {
        expect(
          screen.getByText('report:assessmentRecommendation')
        ).toBeInTheDocument()
        expect(screen.getByText('Assessment Statement')).toBeInTheDocument()
        expect(
          screen.getByText('Assessment Recommendation')
        ).toBeInTheDocument()
      })
    })
  })
})
