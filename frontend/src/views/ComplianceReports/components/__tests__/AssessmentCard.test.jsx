import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import * as useCurrentUserHook from '@/hooks/useCurrentUser.js'
import * as useComplianceReportHook from '@/hooks/useComplianceReports'
import { wrapper } from '@/tests/utils/wrapper'
import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AssessmentCard } from '../AssessmentCard'
import { useOrganizationSnapshot } from '@/hooks/useOrganizationSnapshot.js'

// Mock BCWidgetCard component
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  __esModule: true,
  default: ({ title, content }) => (
    <div>
      <div>{title}</div>
      <div>{content}</div>
    </div>
  )
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn().mockReturnValue({
    keycloak: { authenticated: true }
  })
}))

// Mock useTranslation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      switch (key) {
        case 'report:assessment':
          return 'Assessment'
        case 'report:orgDetails':
          return 'Organization Details'
        case 'report:assessmentLn1':
          return `${options.name} ${options.hasMet}`
        case 'report:assessmentLn2':
          return `${options.name} ${options.hasMet}`
        case 'report:reportHistory':
          return 'Report History'
        case 'report:complianceReportHistory.AssessedBy':
          return `Assessed by ${options.displayName} on ${options.createDate}`
        case 'report:complianceReportHistory.Submitted':
          return `Signed and submitted by ${options.displayName} on ${options.createDate}`
        case 'report:complianceReportHistory.Draft':
          return `Signed and submitted by ${options.displayName} on ${options.createDate}`
        case 'report:supplementalCreated':
          return 'Supplemental report created successfully'
        default:
          return key
      }
    }
  })
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    setForbidden: vi.fn()
  })
}))

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useComplianceReports')
vi.mock('@/hooks/useCreateSupplementalReport')
vi.mock('@/hooks/useOrganizationSnapshot')

describe('AssessmentCard', () => {
  const mockHistory = [
    {
      status: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
      createDate: '2024-10-01',
      userProfile: { firstName: 'John', lastName: 'Doe' },
      displayName: 'John Doe'
    },
    {
      status: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
      createDate: '2024-09-20',
      userProfile: { firstName: 'Jane', lastName: 'Smith' },
      displayName: 'Jane Smith'
    }
  ]

  const mockOrgData = {
    name: 'Test Org',
    orgAddress: '123 Test St, Test City, TC',
    orgAttorneyAddress: '456 Attorney Ave, Legal City, LC'
  }

  it('renders loading state', () => {
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      isLoading: true
    })
    vi.mocked(useComplianceReportHook.useGetComplianceReport).mockReturnValue({
      isLoading: true,
      data: {}
    })
    vi.mocked(useOrganizationSnapshot).mockReturnValue({
      isLoading: true,
      data: {}
    })
    vi.mocked(
      useComplianceReportHook.useCreateSupplementalReport
    ).mockReturnValue({
      mutate: vi.fn()
    })

    render(<AssessmentCard chain={[]} />, { wrapper })
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('renders without crashing', async () => {
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn(() => true),
      isLoading: false
    })
    vi.mocked(useComplianceReportHook.useGetComplianceReport).mockReturnValue({
      isLoading: false,
      data: { report: { curentStatus: { status: 'Assessed' } } }
    })

    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
        complianceReportId="123"
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={[]}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(screen.getByText('Organization Details')).toBeInTheDocument()
    })
  })

  it('renders report history when history is available', async () => {
    const mockChain = [
      {
        history: mockHistory,
        version: 0,
        compliancePeriod: {
          description: '2024'
        },
        organization: {
          name: 'Test Org'
        },
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
      }
    ]

    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
        complianceReportId="123"
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={mockChain}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(
        screen.getByText('Assessed by John Doe on 2024-09-30 5:00 pm PDT')
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Signed and submitted by Jane Smith on 2024-09-19 5:00 pm PDT'
        )
      ).toBeInTheDocument()
    })
  })

  it('filters out DRAFT status from history', async () => {
    const historyWithDraft = [
      ...mockHistory,
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.DRAFT },
        createDate: '2024-08-01',
        userProfile: { firstName: 'Alice', lastName: 'Wong' },
        displayName: 'Alice Wong'
      }
    ]

    const mockChain = [
      {
        history: historyWithDraft,
        version: 0,
        compliancePeriod: {
          description: '2024'
        },
        organization: {
          name: 'Test Org'
        },
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
      }
    ]

    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
        complianceReportId="123"
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={mockChain}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(screen.queryByText('Alice Wong')).not.toBeInTheDocument()
      expect(
        screen.getByText('Assessed by John Doe on 2024-09-30 5:00 pm PDT')
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Signed and submitted by Jane Smith on 2024-09-19 5:00 pm PDT'
        )
      ).toBeInTheDocument()
    })
  })

  it('changes status to "AssessedBy" when the user is not a government user', async () => {
    const mockChain = [
      {
        history: mockHistory,
        version: 0,
        compliancePeriod: {
          description: '2024'
        },
        organization: {
          name: 'Test Org'
        },
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED }
      }
    ]
    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus={COMPLIANCE_REPORT_STATUSES.ASSESSED}
        complianceReportId="123"
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={mockChain}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(
        screen.getByText('Assessed by John Doe on 2024-09-30 5:00 pm PDT')
      ).toBeInTheDocument()
    })
  })
  it('renders assessment statement', async () => {
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn(() => true),
      isLoading: false
    })
    vi.mocked(useComplianceReportHook.useGetComplianceReport).mockReturnValue({
      isLoading: false,
      data: {
        report: {
          curentStatus: { status: 'Assessed' },
          assessmentStatement: 'assessment statement test'
        }
      }
    })
    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={true}
        currentStatus={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
        complianceReportId="123"
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={[]}
      />,
      { wrapper }
    )

    await waitFor(() => {
      expect(screen.getByText('assessment statement test')).toBeInTheDocument()
    })
  })
})
