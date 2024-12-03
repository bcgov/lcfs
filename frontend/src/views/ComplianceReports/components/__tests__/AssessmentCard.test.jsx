import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AssessmentCard } from '../AssessmentCard'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { wrapper } from '@/tests/utils/wrapper'

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
          return `Assessed by ${options.firstName} ${options.lastName} on ${options.createDate}`
        case 'report:complianceReportHistory.Submitted':
          return `Signed and submitted by ${options.firstName} ${options.lastName} on ${options.createDate}`
        case 'report:complianceReportHistory.Draft':
          return `Signed and submitted by ${options.firstName} ${options.lastName} on ${options.createDate}`
        case 'report:supplementalCreated':
          return 'Supplemental report created successfully'
        default:
          return key
      }
    }
  })
}))

describe('AssessmentCard', () => {
  const mockHistory = [
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

  const mockOrgData = {
    name: 'Test Org',
    orgAddress: '123 Test St, Test City, TC',
    orgAttorneyAddress: '456 Attorney Ave, Legal City, LC'
  }

  it('renders without crashing', async () => {
    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasMet={false}
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

  it('renders assessment lines with correct organization name and status', async () => {
    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasMet={true}
        hasSupplemental={true}
        isGovernmentUser={true}
        currentStatus={COMPLIANCE_REPORT_STATUSES.ASSESSED}
        complianceReportId="123"
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={[]}
      />,
      { wrapper }
    )
    await waitFor(() => {
      const assessmentLines = screen.getAllByText('Test Org has met')
      expect(assessmentLines).toHaveLength(2) // Ensure that both lines are present
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
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
      }
    ]

    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasMet={false}
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
  it('filters out DRAFT status from history except when hasSupplemental is true', async () => {
    const historyWithDraft = [
      ...mockHistory,
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.DRAFT },
        createDate: '2024-08-01',
        userProfile: { firstName: 'Alice', lastName: 'Wong' }
      }
    ]

    const mockChain = [
      {
        history: historyWithDraft,
        version: 0,
        compliancePeriod: {
          description: '2024'
        },
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
        hasSupplemental: true
      }
    ]

    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasMet={false}
        hasSupplemental={true}
        isGovernmentUser={false}
        currentStatus={COMPLIANCE_REPORT_STATUSES.SUBMITTED}
        complianceReportId="123"
        alertRef={{ current: { triggerAlert: vi.fn() } }}
        chain={mockChain}
      />,
      { wrapper }
    )
    await waitFor(() => {
      expect(screen.getByText(/Alice Wong/)).toBeInTheDocument()
    })
  })

  it('filters out DRAFT status from history', async () => {
    const historyWithDraft = [
      ...mockHistory,
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.DRAFT },
        createDate: '2024-08-01',
        userProfile: { firstName: 'Alice', lastName: 'Wong' }
      }
    ]

    const mockChain = [
      {
        history: historyWithDraft,
        version: 0,
        compliancePeriod: {
          description: '2024'
        },
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
      }
    ]

    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasMet={false}
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
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED }
      }
    ]
    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasMet={true}
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

  it('displays organization information', async () => {
    const mockChain = [
      {
        history: mockHistory,
        version: 0,
        compliancePeriod: {
          description: '2024'
        },
        currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED }
      }
    ]
    render(
      <AssessmentCard
        orgData={mockOrgData}
        hasMet={true}
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
      expect(screen.getByText(/report:serviceAddrLabel/)).toBeInTheDocument()
      expect(screen.getByText(/report:bcAddrLabel/)).toBeInTheDocument()
    })
  })
})
