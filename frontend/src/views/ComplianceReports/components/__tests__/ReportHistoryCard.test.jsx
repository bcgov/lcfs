import React from 'react'
import { render, screen } from '@testing-library/react'
import { ReportHistoryCard } from '../ReportHistoryCard'
import { vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'

// Mock the useTranslation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => key,
  }),
}))

// Mock custom components
vi.mock('@/components/BCWidgetCard', () => ({
  default: ({ children, title }) => (
    <div data-test="BCWidgetCard">
      {title}
      {children}
    </div>
  ),
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

// Mock utility functions
vi.mock('@/utils/formatters', () => ({
  timezoneFormatter: ({ value }) => value,
}))

describe('ReportHistoryCard', () => {
  const history = [
    {
      status: { status: 'Draft' },
      createDate: '2024-09-24 11:07:32.045 -0700',
      userProfile: { firstName: 'John', lastName: 'Doe' },
    },
    {
      status: { status: 'Submitted' },
      createDate: '2024-09-25 11:07:32.045 -0700',
      userProfile: { firstName: 'Alice', lastName: 'Smith' },
    },
    {
      status: { status: 'Recommended_by_analyst' },
      createDate: '2024-09-26 11:07:32.045 -0700',
      userProfile: { firstName: 'Bob', lastName: 'Jones' },
    },
    {
      status: { status: 'Assessed' },
      createDate: '2024-09-27 11:07:32.045 -0700',
      userProfile: { firstName: 'Carol', lastName: 'Brown' },
    },
  ]

  test('returns null when history is null or empty', () => {
    const { container } = render(
      <ReportHistoryCard history={null} isGovernmentUser={false} currentStatus="Submitted" />,
      { wrapper }
    )
    expect(container.firstChild).toBeNull()

    const { container: container2 } = render(
      <ReportHistoryCard history={[]} isGovernmentUser={false} currentStatus="Submitted" />,
      { wrapper }
    )
    expect(container2.firstChild).toBeNull()
  })

  test('government user sees all statuses except Draft', () => {
    render(
      <ReportHistoryCard history={history} isGovernmentUser={true} currentStatus="Assessed" />,
      { wrapper }
    )

    // Verify that the statuses 'Submitted', 'Recommended_by_analyst', and 'Assessed' are displayed
    expect(screen.getByText('report:complianceReportHistory.SubmittedTitle')).toBeInTheDocument()
    expect(
      screen.getByText('report:complianceReportHistory.Recommended_by_analystTitle')
    ).toBeInTheDocument()
    expect(screen.getByText('report:complianceReportHistory.AssessedTitle')).toBeInTheDocument()

    // Verify that 'Draft' is not displayed
    expect(screen.queryByText('report:complianceReportHistory.DraftTitle')).not.toBeInTheDocument()
  })

  test('non-government user sees only Submitted status when currentStatus is Assessed', () => {
    render(
      <ReportHistoryCard history={history} isGovernmentUser={false} currentStatus="Assessed" />,
      { wrapper }
    )

    // Verify that only 'Submitted' status is displayed
    expect(screen.getByText('report:complianceReportHistory.SubmittedTitle')).toBeInTheDocument()

    // Verify that other statuses are not displayed
    expect(
      screen.queryByText('report:complianceReportHistory.Recommended_by_analystTitle')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('report:complianceReportHistory.AssessedTitle')).not.toBeInTheDocument()
    expect(screen.queryByText('report:complianceReportHistory.DraftTitle')).not.toBeInTheDocument()
  })

  test('non-government user sees nothing when currentStatus is not Assessed or ReAssessed', () => {
    const { container } = render(
      <ReportHistoryCard history={history} isGovernmentUser={false} currentStatus="Submitted" />,
      { wrapper }
    )
    expect(container.firstChild).toBeNull()
  })

  test('non-government user sees only Submitted status when currentStatus is ReAssessed', () => {
    render(
      <ReportHistoryCard history={history} isGovernmentUser={false} currentStatus="ReAssessed" />,
      { wrapper }
    )

    // Verify that only 'Submitted' status is displayed
    expect(screen.getByText('report:complianceReportHistory.SubmittedTitle')).toBeInTheDocument()

    // Verify that other statuses are not displayed
    expect(
      screen.queryByText('report:complianceReportHistory.Recommended_by_analystTitle')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('report:complianceReportHistory.AssessedTitle')).not.toBeInTheDocument()
    expect(screen.queryByText('report:complianceReportHistory.DraftTitle')).not.toBeInTheDocument()
  })
})
