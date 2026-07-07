import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalystReviewSummary } from '..'

const mockUseGetComplianceReportReviewSummary = vi.fn()

vi.mock('@/hooks/useComplianceReports', () => ({
  useGetComplianceReportReviewSummary: (...args: any[]) =>
    mockUseGetComplianceReportReviewSummary(...args)
}))

vi.mock('echarts-for-react', () => ({
  default: () => <div data-test="echarts" />
}))

const reviewData = {
  summary: '',
  sections: [
    {
      section: 'Electricity/FSE',
      status: 'review',
      findings: [
        {
          reviewArea: 'Electricity/FSE',
          severity: 'review',
          title: 'FSE validation status needs review',
          detail: 'One or more reported FSE rows are not in validated status.',
          source: 'FSE reporting view',
          evidence: [{ label: 'Validated FSE', value: 2 }],
          suggestedFollowUp: null,
          confidence: 'high'
        }
      ]
    }
  ],
  topFollowUpQuestions: [
    'Which FSE rows are not validated?',
    ' which   fse rows are not validated? '
  ],
  chartData: {}
}

describe('AnalystReviewSummary', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockUseGetComplianceReportReviewSummary.mockReset()
  })

  it('shows Methy drafting state while loading', () => {
    mockUseGetComplianceReportReviewSummary.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false
    })

    render(<AnalystReviewSummary complianceReportId={101} />)

    expect(screen.getByText(/is drafting the pre-screen/i)).toBeInTheDocument()
  })

  it('shows an unavailable alert when the summary cannot load', () => {
    mockUseGetComplianceReportReviewSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true
    })

    render(<AnalystReviewSummary complianceReportId={101} />)

    expect(
      screen.getByText('Methy pre-screen is unavailable.')
    ).toBeInTheDocument()
  })

  it('deduplicates follow-up questions and persists addressed findings', async () => {
    const user = userEvent.setup()
    mockUseGetComplianceReportReviewSummary.mockReturnValue({
      data: reviewData,
      isLoading: false,
      isError: false
    })

    render(<AnalystReviewSummary complianceReportId={101} />)

    expect(
      screen.getAllByText('Which FSE rows are not validated?')
    ).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /Methy pre-screen/i }))
    await user.click(screen.getByRole('button', { name: /Electricity\/FSE/i }))
    await user.click(screen.getByRole('checkbox', { name: /addressed/i }))

    await waitFor(() => {
      expect(
        JSON.parse(
          window.localStorage.getItem('analyst-review-addressed-101') || '[]'
        )
      ).toEqual([
        'Electricity/FSE|review|FSE reporting view|FSE validation status needs review|0'
      ])
    })
  })
})
