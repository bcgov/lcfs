import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'
import * as useCurrentUserHook from '@/hooks/useCurrentUser.js'
import { wrapper } from '@/tests/utils/wrapper'
import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AssessmentCard } from '../AssessmentCard'
import { useOrganizationSnapshot } from '@/hooks/useOrganizationSnapshot.js'
import * as useComplianceReportHook from '@/hooks/useComplianceReports.js'

vi.mock('@/constants/config.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    isFeatureEnabled: vi.fn(() => true)
  }
})

vi.mock('@/views/ComplianceReports/components/OrganizationAddress.jsx', () => ({
  OrganizationAddress: () => <div />
}))

vi.mock('@/hooks/useOrganizationSnapshot.js', () => ({
  useOrganizationSnapshot: vi.fn(() => ({
    data: { isEdited: false },
    isLoading: false
  })),
  useUpdateOrganizationSnapshot: vi.fn(() => ({
    mutate: vi.fn(),
    isLoading: false
  }))
}))

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
          return `Assessed by the director under the Low Carbon Fuels Act.`
        case 'report:complianceReportHistory.Assessed':
          return `Assessed by John Doe on 2024-09-30 5:00 pm PDT`
        case 'report:complianceReportHistory.Submitted':
          return `Signed and submitted by Jane Smith on 2024-09-19 5:00 pm PDT`
        case 'report:complianceReportHistory.Draft':
          return `Draft ${options.createDate} by ${options.displayName}.`
        case 'report:supplementalCreated':
          return 'Supplemental report created successfully'
        case 'report:complianceReportHistory.directorStatement':
          return 'Assessment statement from the director'
        case 'report:complianceReportHistory.canBeEdited':
          return '(can be edited)'
        default:
          return key
      }
    }
  })
}))

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn()
  })
}))

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useComplianceReports')
vi.mock('@/hooks/useCreateSupplementalReport')
vi.mock('@/hooks/useOrganizationSnapshot')

vi.mocked(useOrganizationSnapshot).mockReturnValue({
  isLoading: true,
  data: {}
})

vi.mocked(useComplianceReportHook.useCreateSupplementalReport).mockReturnValue({
  mutate: vi.fn()
})

// Mock timezoneFormatter
vi.mock('@/utils/formatters', () => ({
  timezoneFormatter: vi.fn(({ value }) => `formatted-${value}`)
}))

// Mock HistoryCard component
vi.mock('@/views/ComplianceReports/components/HistoryCard.jsx', () => ({
  HistoryCard: ({ report, defaultExpanded }) => {
    // Simple mock that renders something similar to the original
    // Filter out DRAFT elements from the history that we render
    const filteredHistory = report.history
      ? report.history.filter(
          (item) => item.status.status !== COMPLIANCE_REPORT_STATUSES.DRAFT
        )
      : []

    return (
      <div>
        {filteredHistory.map((item, index) => (
          <div key={index} data-testid={`history-item-${index}`}>
            {item.status.status === COMPLIANCE_REPORT_STATUSES.ASSESSED
              ? 'Assessed by John Doe on 2024-09-30 5:00 pm PDT'
              : `Signed and submitted by ${item.displayName || 'Jane Smith'} on 2024-09-19 5:00 pm PDT`}
          </div>
        ))}
        {report.assessmentStatement && (
          <div data-test="assessment-statement">
            {report.assessmentStatement}
          </div>
        )}
      </div>
    )
  }
}))

describe('AssessmentCard', () => {
  const mockHistory = [
    {
      status: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
      createDate: '2024-10-01',
      userProfile: { firstName: 'John', lastName: 'Doe' },
      displayName: 'John Doe',
      summary: {
        line11FossilDerivedBaseFuelTotal: 1
      }
    },
    {
      status: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
      createDate: '2024-09-20',
      userProfile: { firstName: 'Jane', lastName: 'Smith' },
      displayName: 'Jane Smith',
      summary: {
        line11FossilDerivedBaseFuelTotal: 1
      }
    }
  ]

  const mockOrgData = {
    name: 'Test Org',
    orgAddress: '123 Test St, Test City, TC',
    orgAttorneyAddress: '456 Attorney Ave, Legal City, LC'
  }

  it('renders without crashing', async () => {
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn(() => true),
      isLoading: false
    })

    const { container } = render(
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
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
        summary: {
          line11FossilDerivedBaseFuelTotal: 1
        }
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
        displayName: 'Alice Wong',
        summary: {
          line11FossilDerivedBaseFuelTotal: 1
        }
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
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
        summary: {
          line11FossilDerivedBaseFuelTotal: 1
        }
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
      expect(screen.getAllByText(/Signed and submitted by/)).toHaveLength(1)
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
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
        summary: {
          line11FossilDerivedBaseFuelTotal: 1
        }
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
      isLoading: false,
      data: { isGovernmentUser: true }
    })
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
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
        summary: {
          line11FossilDerivedBaseFuelTotal: 1
        },
        assessmentStatement: 'assessment statement test'
      }
    ]
    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={true}
        currentStatus={COMPLIANCE_REPORT_STATUSES.ASSESSED}
        complianceReportId="123"
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={mockChain}
      />,
      { wrapper }
    )

    await waitFor(() => {
      expect(screen.getByText('assessment statement test')).toBeInTheDocument()
    })
  })
})

describe('AssessmentCard - supplier visibility of Create Supplemental button', () => {
  beforeEach(() => {
    vi.spyOn(useCurrentUserHook, 'useCurrentUser').mockReturnValue({
      hasRoles: (r) => r === roles.supplier,
      data: { isGovernmentUser: false, roles: [{ name: roles.supplier }] }
    })
    vi.mocked(useOrganizationSnapshot).mockReturnValue({
      data: { isEdited: false },
      isLoading: false
    })
  })

  it('hides Create Supplemental when hasGovernmentReassessmentInProgress is true', async () => {
    const mockOrgData = { name: 'Test Org' }
    const { container } = render(
      <AssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus={COMPLIANCE_REPORT_STATUSES.ASSESSED}
        complianceReportId={1}
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={[
          {
            version: 0,
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
            history: [
              { status: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED } }
            ]
          }
        ]}
        setModalData={vi.fn()}
        hasGovernmentReassessmentInProgress={true}
      />,
      { wrapper }
    )

    await waitFor(() => {
      expect(
        container.querySelector('[data-test="create-supplemental"]')
      ).toBeNull()
    })
  })

  it('shows Create Supplemental when hasGovernmentReassessmentInProgress is false', async () => {
    const mockOrgData = { name: 'Test Org' }
    const { container } = render(
      <AssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={false}
        currentStatus={COMPLIANCE_REPORT_STATUSES.ASSESSED}
        complianceReportId={1}
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={[
          {
            version: 0,
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
            history: [
              { status: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED } }
            ]
          }
        ]}
        setModalData={vi.fn()}
        hasGovernmentReassessmentInProgress={false}
      />,
      { wrapper }
    )

    await waitFor(() => {
      const el = container.querySelector('[data-test="create-supplemental"]')
      expect(el).toBeTruthy()
    })
  })
})

describe('AssessmentCard - assessedMessage indirect testing', () => {
  const mockHistory = [
    {
      status: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
      createDate: '2024-10-01',
      userProfile: { firstName: 'John', lastName: 'Doe' },
      displayName: 'John Doe',
      summary: {
        line11FossilDerivedBaseFuelTotal: 1
      }
    }
  ]

  const mockOrgData = {
    name: 'Test Org'
  }

  beforeEach(() => {
    vi.mocked(useCurrentUserHook.useCurrentUser).mockReturnValue({
      hasRoles: vi.fn(() => true),
      isLoading: false
    })
  })

  it('shows assessment statement in first history card when present', async () => {
    const mockChain = [
      {
        history: mockHistory,
        version: 1,
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
        assessmentStatement: 'Test assessment statement'
      }
    ]

    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={true}
        currentStatus={COMPLIANCE_REPORT_STATUSES.ASSESSED}
        complianceReportId="123"
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={mockChain}
      />,
      { wrapper }
    )

    await waitFor(() => {
      expect(screen.getByText('Test assessment statement')).toBeInTheDocument()
    })
  })

  it('does not show assessment statement when it is null', async () => {
    const mockChain = [
      {
        history: mockHistory,
        version: 1,
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
        assessmentStatement: null
      }
    ]

    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={true}
        currentStatus={COMPLIANCE_REPORT_STATUSES.ASSESSED}
        complianceReportId="123"
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={mockChain}
      />,
      { wrapper }
    )

    await waitFor(() => {
      expect(
        screen.queryByTestId('assessment-statement')
      ).not.toBeInTheDocument()
    })
  })

  // Test for the fix: Hide assessment statements for supplemental reports in draft status for IDIR users
  it('hides assessment statement for supplemental reports in draft status for IDIR users', async () => {
    const mockChain = [
      {
        history: mockHistory,
        version: 1, // Supplemental report (version > 0)
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }, // Not draft for history to show
        assessmentStatement: 'Test assessment statement'
      }
    ]

    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={true} // IDIR user
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT} // Draft status
        complianceReportId="123"
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={mockChain}
        reportVersion={1} // Supplemental report
      />,
      { wrapper }
    )

    await waitFor(() => {
      // Report history should still be hidden because currentStatus is DRAFT
      expect(screen.queryByText('Report History')).not.toBeInTheDocument()
      // Assessment statement should not be present
      expect(
        screen.queryByText('Test assessment statement')
      ).not.toBeInTheDocument()
    })
  })

  it('shows assessment statement for supplemental reports in non-draft status for IDIR users', async () => {
    const mockChain = [
      {
        history: mockHistory,
        version: 1, // Supplemental report (version > 0)
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
        assessmentStatement: 'Test assessment statement'
      }
    ]

    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={true} // IDIR user
        currentStatus={COMPLIANCE_REPORT_STATUSES.SUBMITTED} // Non-draft status
        complianceReportId="123"
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={mockChain}
        reportVersion={1} // Supplemental report
      />,
      { wrapper }
    )

    await waitFor(() => {
      // Report history should be visible since it's not in draft
      expect(screen.getByText('Report History')).toBeInTheDocument()
      // Assessment statement should be visible for supplemental reports in submitted status
      expect(screen.getByText('Test assessment statement')).toBeInTheDocument()
    })
  })

  it('shows assessment statement for original reports in any status for IDIR users', async () => {
    const mockChain = [
      {
        history: mockHistory,
        version: 0, // Original report (version = 0)
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
        assessmentStatement: 'Test assessment statement'
      }
    ]

    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasSupplemental={false}
        isGovernmentUser={true} // IDIR user
        currentStatus={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
        complianceReportId="123"
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={mockChain}
        reportVersion={0} // Original report
      />,
      { wrapper }
    )

    await waitFor(() => {
      // Report history should be visible
      expect(screen.getByText('Report History')).toBeInTheDocument()
      // Assessment statement should be visible for original reports
      expect(screen.getByText('Test assessment statement')).toBeInTheDocument()
    })
  })
})
