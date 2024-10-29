import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditViewComplianceReport } from '../EditViewComplianceReport'
import * as useComplianceReportsHook from '@/hooks/useComplianceReports'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import * as useOrganizationHook from '@/hooks/useOrganization'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { wrapper } from '@/tests/utils/wrapper'

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

vi.mock('../../components/Documents/DocumentUploadDialog', () => ({
  default: () => <div>Document Upload Dialog</div>
}))

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
        hasRoles: mockHasRoles
      },
      complianceReport: {
        data: {
          data: {
            organizationId: '123',
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT }
          }
        },
        isLoading: false,
        isError: false
      },
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
    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue(
      mocks.complianceReport
    )
    vi.mocked(useOrganizationHook.useOrganization).mockReturnValue(
      mocks.organization
    )
    vi.mocked(
      useComplianceReportsHook.useUpdateComplianceReport
    ).mockReturnValue({ mutate: vi.fn() })
  }

  beforeEach(() => {
    vi.resetAllMocks()
    setupMocks()
  })

  it('renders the component', async () => {
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      expect(
        screen.getByText('2023 report:complianceReport')
      ).toBeInTheDocument()
    })
  })

  it('displays organization information', async () => {
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('report:serviceAddrLabel:')).toBeInTheDocument()
      expect(screen.getByText('report:bcAddrLabel:')).toBeInTheDocument()
    })
  })

  it('renders report components', async () => {
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('Report Details')).toBeInTheDocument()
      expect(screen.getByText('Compliance Report Summary')).toBeInTheDocument()
      expect(screen.getByText('Introduction')).toBeInTheDocument()
    })
  })

  it('renders DocumentUploadDialog for Draft status', async () => {
    setupMocks({
      complianceReport: {
        data: {
          data: { currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT } }
        }
      }
    })
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      expect(
        screen.getByText('Upload supporting documents for your report.')
      ).toBeInTheDocument()
    })
  })

  it('displays an alert message when location state has a message', async () => {
    setupMocks({
      useLocation: { state: { message: 'Test alert', severity: 'success' } }
    })
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('Test alert')).toBeInTheDocument()
    })
  })

  it('displays an error message when there is an error fetching the report', async () => {
    setupMocks({
      complianceReport: {
        isError: true,
        error: { message: 'Error fetching report' }
      }
    })
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('Error fetching report')).toBeInTheDocument()
    })
  })

  it('displays the correct buttons for Submitted status with Analyst role', async () => {
    setupMocks({
      complianceReport: {
        data: {
          data: {
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
          }
        }
      },
      currentUser: {
        data: { isGovernmentUser: true },
        hasRoles: (role) => role === 'Analyst'
      }
    })
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      expect(
        screen.getByText('report:actionBtns.recommendReportAnalystBtn')
      ).toBeInTheDocument()
    })
  })

  it('displays the correct buttons for Recommended by Analyst status with Compliance Manager role', async () => {
    setupMocks({
      complianceReport: {
        data: {
          data: {
            currentStatus: {
              status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
            }
          }
        }
      },
      currentUser: {
        data: { isGovernmentUser: true },
        hasRoles: (role) => role === 'Compliance Manager'
      }
    })
    render(<EditViewComplianceReport />, { wrapper })
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
    setupMocks({
      complianceReport: {
        data: {
          data: {
            currentStatus: {
              status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
            }
          }
        }
      },
      currentUser: {
        data: { isGovernmentUser: true },
        hasRoles: (role) => role === 'Director'
      }
    })
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      expect(
        screen.getByText('report:actionBtns.assessReportBtn')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:actionBtns.returnToManager')
      ).toBeInTheDocument()
    })
  })

  it('displays the correct buttons for Assessed status with Analyst role', async () => {
    setupMocks({
      complianceReport: {
        data: {
          data: {
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED }
          }
        }
      },
      currentUser: {
        data: { isGovernmentUser: true },
        hasRoles: (role) => role === 'Analyst'
      }
    })
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      expect(
        screen.getByText('report:actionBtns.reAssessReportBtn')
      ).toBeInTheDocument()
    })
  })

  it('does not display action buttons for non-government users on submitted reports', async () => {
    setupMocks({
      complianceReport: {
        data: {
          data: {
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
          }
        }
      },
      currentUser: { data: { isGovernmentUser: false }, hasRoles: () => false }
    })
    render(<EditViewComplianceReport />, { wrapper })
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
    setupMocks({
      currentUser: { data: { isGovernmentUser: true }, hasRoles: () => true }
    })
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('report:internalComments')).toBeInTheDocument()
    })
  })

  it('does not display internal comments section for non-government users', async () => {
    setupMocks({
      currentUser: { data: { isGovernmentUser: false }, hasRoles: () => false }
    })
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      expect(
        screen.queryByText('report:internalComments')
      ).not.toBeInTheDocument()
    })
  })

  it('displays ActivityListCard for Draft status', async () => {
    setupMocks({
      complianceReport: {
        data: {
          data: { currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT } }
        }
      }
    })
    render(<EditViewComplianceReport />, { wrapper })
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

    vi.mocked(useComplianceReportsHook.useGetComplianceReport).mockReturnValue({
      data: {
        data: {
          currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
          history: historyMock
        }
      },
      isLoading: false,
      isError: false
    })

    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('report:assessment')).toBeInTheDocument()
      expect(screen.getByText('report:reportHistory')).toBeInTheDocument()
      expect(
        screen.getByText('report:complianceReportHistory.AssessedBy')
      ).toBeInTheDocument()
    })
  })

  it('displays ImportantInfoCard for non-government users when status is not Draft', async () => {
    setupMocks({
      complianceReport: {
        data: {
          data: {
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
          }
        }
      },
      currentUser: { data: { isGovernmentUser: false }, hasRoles: () => false }
    })
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('report:impInfoTitle')).toBeInTheDocument()
    })
  })

  it('displays scroll-to-top button when scrolling down', async () => {
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      fireEvent.scroll(window, { target: { pageYOffset: 100 } })
      expect(screen.getByLabelText('scroll to bottom')).toBeInTheDocument()
    })
  })

  it('displays scroll-to-bottom button when at the top of the page', async () => {
    render(<EditViewComplianceReport />, { wrapper })
    await waitFor(() => {
      fireEvent.scroll(window, { target: { pageYOffset: 0 } })
      expect(screen.getByLabelText('scroll to top')).toBeInTheDocument()
    })
  })
})
