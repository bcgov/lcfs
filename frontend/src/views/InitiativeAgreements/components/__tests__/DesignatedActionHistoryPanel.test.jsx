import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DesignatedActionHistoryPanel } from '../DesignatedActionHistoryPanel'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Render the key plus its interpolations so assertions can see values.
    t: (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key)
  })
}))

vi.mock('@/utils/formatters', () => ({
  timezoneFormatter: ({ value }) => (value ? '2026-08-26 10:14' : '')
}))

const mockHistory = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useDesignatedActionHistory: () => mockHistory()
}))

const entry = (overrides = {}) => ({
  designatedActionHistoryId: 1,
  event: 'STATUS_CHANGE',
  displayName: 'Alex Zorkin',
  createDate: '2026-08-26T10:14:00Z',
  status: { designatedActionStatusId: 7, status: 'Approved' },
  snapshot: null,
  ...overrides
})

describe('DesignatedActionHistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHistory.mockReturnValue({ data: [entry()], isLoading: false })
  })

  it('shows who did what and when', () => {
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, { wrapper })

    const row = screen.getByTestId('history-entry-1')
    expect(row).toHaveTextContent('Alex Zorkin')
    expect(row).toHaveTextContent('2026-08-26 10:14')
    expect(row).toHaveTextContent('history.events.statusChange')
    expect(row).toHaveTextContent('Approved')
  })

  it('names the analyst on an assignment rather than showing an id', () => {
    mockHistory.mockReturnValue({
      data: [
        entry({
          designatedActionHistoryId: 2,
          event: 'ANALYST_REASSIGNED',
          status: null,
          snapshot: {
            from_analyst_id: 5,
            to_analyst_id: 7,
            from_analyst: 'Harriet Fong',
            to_analyst: 'Jo Willems'
          }
        })
      ],
      isLoading: false
    })
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, { wrapper })

    const row = screen.getByTestId('history-entry-2')
    expect(row).toHaveTextContent('Harriet Fong')
    expect(row).toHaveTextContent('Jo Willems')
    expect(row).not.toHaveTextContent('from_analyst_id')
  })

  it('shows the reason given with a request for information', () => {
    mockHistory.mockReturnValue({
      data: [
        entry({
          designatedActionHistoryId: 3,
          event: 'INFORMATION_REQUESTED',
          status: null,
          snapshot: { comment: 'Send the signed permit for stage two.' }
        })
      ],
      isLoading: false
    })
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, { wrapper })

    expect(screen.getByTestId('history-comment')).toHaveTextContent(
      'Send the signed permit for stage two.'
    )
  })

  it('shows the recommended amount', () => {
    mockHistory.mockReturnValue({
      data: [
        entry({
          designatedActionHistoryId: 4,
          event: 'CREDITS_RECOMMENDED',
          status: null,
          snapshot: { recommended_credits: 1200 }
        })
      ],
      isLoading: false
    })
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, { wrapper })

    expect(screen.getByTestId('history-entry-4')).toHaveTextContent('1,200')
  })

  it('shows a recommendation of nought rather than treating it as absent', () => {
    mockHistory.mockReturnValue({
      data: [
        entry({
          designatedActionHistoryId: 5,
          event: 'CREDITS_RECOMMENDED',
          status: null,
          snapshot: { recommended_credits: 0 }
        })
      ],
      isLoading: false
    })
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, { wrapper })

    expect(screen.getByTestId('history-entry-5')).toHaveTextContent(
      'history.recommendedCredits'
    )
  })

  it('keeps the captured evidence behind a toggle', () => {
    mockHistory.mockReturnValue({
      data: [
        entry({
          designatedActionHistoryId: 6,
          event: 'INFORMATION_REQUESTED',
          status: null,
          snapshot: {
            comment: 'One outstanding.',
            evidence_requirements: [
              {
                evidence_requirement_id: 1,
                description: 'List of major permits',
                review_outcome: 'Satisfactory',
                analyst_review: 'Permits verified.'
              },
              {
                evidence_requirement_id: 2,
                description: 'Risk register',
                review_outcome: 'Information requested',
                analyst_review: null
              }
            ]
          }
        })
      ],
      isLoading: false
    })
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, { wrapper })

    // Summary counts are visible without expanding.
    const toggle = screen.getByTestId('history-evidence-toggle')
    expect(toggle).toHaveTextContent('"satisfactory":1')
    expect(toggle).toHaveTextContent('"outstanding":1')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const detail = screen.getByTestId('history-evidence-detail')
    expect(detail).toHaveTextContent('List of major permits')
    expect(detail).toHaveTextContent('Permits verified.')
    expect(detail).toHaveTextContent('Risk register')
  })

  it('renders an entry whose event it does not recognise', () => {
    mockHistory.mockReturnValue({
      data: [
        entry({
          designatedActionHistoryId: 7,
          event: 'SOMETHING_NEW',
          status: null
        })
      ],
      isLoading: false
    })
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, { wrapper })

    expect(screen.getByTestId('history-entry-7')).toHaveTextContent(
      'history.events.unknown'
    )
  })

  it('shows an empty state before anything has happened', () => {
    mockHistory.mockReturnValue({ data: [], isLoading: false })
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, { wrapper })

    expect(
      screen.getByText('initiativeAgreement:history.empty')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('history-entry-1')).not.toBeInTheDocument()
  })

  it('collapses the panel', () => {
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, { wrapper })

    const toggle = screen.getByTestId('history-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
