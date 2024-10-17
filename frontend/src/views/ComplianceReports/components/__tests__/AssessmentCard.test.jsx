import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AssessmentCard } from '../AssessmentCard'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

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

// Mock useTranslation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      switch (key) {
        case 'report:assessment':
          return 'Assessment'
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

  it('renders without crashing', async () => {
    render(
      <AssessmentCard orgName="Test Org" hasMet={false} history={mockHistory} isGovernmentUser={false} />
    )
    await waitFor(() => {
      expect(screen.getByText('Assessment')).toBeInTheDocument()
    })
  })

  it('renders assessment lines with correct organization name and status', async () => {
    render(
      <AssessmentCard orgName="Test Org" hasMet={true} history={mockHistory} isGovernmentUser={true} />
    )
    await waitFor(() => {
      const assessmentLines = screen.getAllByText('Test Org has met')
      expect(assessmentLines).toHaveLength(2) // Ensure that both lines are present
    })
  })

  it('renders report history when history is available', async () => {
    render(
      <AssessmentCard orgName="Test Org" hasMet={false} history={mockHistory} isGovernmentUser={false} />
    )
    await waitFor(() => {
      expect(screen.getByText('Assessed by John Doe on 2024-09-30 5:00 pm PDT')).toBeInTheDocument()
      expect(screen.getByText('Signed and submitted by Jane Smith on 2024-09-19 5:00 pm PDT')).toBeInTheDocument()
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

    render(
      <AssessmentCard orgName="Test Org" hasMet={false} history={historyWithDraft} isGovernmentUser={false} />
    )
    await waitFor(() => {
      expect(screen.queryByText('Alice Wong')).not.toBeInTheDocument()
      expect(screen.getByText('Assessed by John Doe on 2024-09-30 5:00 pm PDT')).toBeInTheDocument()
      expect(screen.getByText('Signed and submitted by Jane Smith on 2024-09-19 5:00 pm PDT')).toBeInTheDocument()
    })
  })

  it('changes status to "AssessedBy" when the user is not a government user', async () => {
    render(
      <AssessmentCard orgName="Test Org" hasMet={true} history={mockHistory} isGovernmentUser={false} />
    )
    await waitFor(() => {
      expect(screen.getByText('Assessed by John Doe on 2024-09-30 5:00 pm PDT')).toBeInTheDocument()
    })
  })

  it('returns null if there is no history', async () => {
    const { container } = render(
      <AssessmentCard orgName="Test Org" hasMet={false} history={[]} isGovernmentUser={false} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('returns null if history is not passed', async () => {
    const { container } = render(
      <AssessmentCard orgName="Test Org" hasMet={false} isGovernmentUser={false} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
