import React from 'react'
import { fireEvent, screen } from '@testing-library/react'

import { describe, expect, vi, beforeEach } from 'vitest'

import { DesignatedActionHistoryPanel } from '../DesignatedActionHistoryPanel'
import { test } from '@/tests/utils/fixtures'

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

  test('shows who did what and when', ({ render, app }) => {
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    const row = screen.getByTestId('history-entry-1')
    expect(row).toHaveTextContent('Alex Zorkin')
    expect(row).toHaveTextContent('2026-08-26 10:14')
    expect(row).toHaveTextContent('history.events.statusChange')
    expect(row).toHaveTextContent('Approved')
  })

  test('names the analyst on an assignment rather than showing an id', ({
    render,
    app
  }) => {
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
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    const row = screen.getByTestId('history-entry-2')
    expect(row).toHaveTextContent('Harriet Fong')
    expect(row).toHaveTextContent('Jo Willems')
    expect(row).not.toHaveTextContent('from_analyst_id')
  })

  test('shows the reason given with a request for information', ({
    render,
    app
  }) => {
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
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    expect(screen.getByTestId('history-comment')).toHaveTextContent(
      'Send the signed permit for stage two.'
    )
  })

  test('shows the recommended amount', ({ render, app }) => {
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
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    expect(screen.getByTestId('history-entry-4')).toHaveTextContent('1,200')
  })

  test('shows a recommendation of nought rather than treating it as absent', ({
    render,
    app
  }) => {
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
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    expect(screen.getByTestId('history-entry-5')).toHaveTextContent(
      'history.recommendedCredits'
    )
  })

  test('keeps the captured evidence behind a toggle', ({ render, app }) => {
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
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    // Summary counts are visible without expanding.
    const summary = screen.getByTestId('history-entry-summary-6')
    expect(summary).toHaveTextContent('"satisfactory":1')
    expect(summary).toHaveTextContent('"outstanding":1')
    const toggle = screen.getByTestId('history-entry-toggle-6')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('history-evidence-detail')).not.toBeVisible()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const detail = screen.getByTestId('history-evidence-detail')
    expect(detail).toHaveTextContent('List of major permits')
    expect(detail).toHaveTextContent('Permits verified.')
    expect(detail).toHaveTextContent('Risk register')
  })

  test('renders an entry whose event it does not recognise', ({
    render,
    app
  }) => {
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
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    expect(screen.getByTestId('history-entry-7')).toHaveTextContent(
      'history.events.unknown'
    )
  })

  test('groups entries by what kind of thing happened, in a fixed order', ({
    render,
    app
  }) => {
    mockHistory.mockReturnValue({
      data: [
        entry({ designatedActionHistoryId: 10, event: 'ANALYST_ASSIGNED' }),
        entry({ designatedActionHistoryId: 11, event: 'EVIDENCE_REVIEWED' }),
        entry({ designatedActionHistoryId: 12, event: 'STATUS_CHANGE' }),
        entry({ designatedActionHistoryId: 13, event: 'DETAILS_EDITED' }),
        entry({ designatedActionHistoryId: 14, event: 'INFORMATION_REQUESTED' })
      ],
      isLoading: false
    })
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    // Evidence review first: it is what a manager or director reads.
    const groups = screen
      .getAllByTestId(/^history-group-(?!toggle|count|body)/)
      .map((node) => node.getAttribute('data-test'))
    expect(groups).toEqual([
      'history-group-evidenceReview',
      'history-group-workflow',
      'history-group-assignment',
      'history-group-recordChanges'
    ])
    expect(
      screen.getByTestId('history-group-count-evidenceReview')
    ).toHaveTextContent('2')
    expect(
      screen.getByTestId('history-group-count-assignment')
    ).toHaveTextContent('1')
    // The API order (newest first) is kept within a group.
    const review = screen.getByTestId('history-group-evidenceReview')
    const ids = Array.from(
      review.querySelectorAll('[data-test^="history-entry-"]')
    )
      .map((node) => node.getAttribute('data-test'))
      .filter((id) => /^history-entry-\d+$/.test(id))
    expect(ids).toEqual(['history-entry-11', 'history-entry-14'])
  })

  test('shows only the groups that have entries', ({ render, app }) => {
    mockHistory.mockReturnValue({
      data: [entry({ designatedActionHistoryId: 20, event: 'STATUS_CHANGE' })],
      isLoading: false
    })
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    expect(screen.getByTestId('history-group-workflow')).toBeInTheDocument()
    expect(screen.queryByTestId('history-group-evidenceReview')).toBeNull()
    expect(screen.queryByTestId('history-group-assignment')).toBeNull()
    expect(screen.queryByTestId('history-group-recordChanges')).toBeNull()
  })

  test('puts an event it does not recognise under Other rather than dropping it', ({
    render,
    app
  }) => {
    mockHistory.mockReturnValue({
      data: [entry({ designatedActionHistoryId: 21, event: 'SOMETHING_NEW' })],
      isLoading: false
    })
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    expect(screen.getByTestId('history-group-other')).toHaveTextContent(
      'history.events.unknown'
    )
  })

  test('a group collapses and expands from its heading', ({ render, app }) => {
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    const toggle = screen.getByTestId('history-group-toggle-workflow')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('history-entry-1')).toBeVisible()

    fireEvent.click(toggle)

    // The announced state is the contract; the collapse itself animates,
    // so its visibility is not synchronous here.
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute(
      'aria-controls',
      'history-group-body-workflow'
    )
  })

  test('lists each requirement by number and title, falling back to the description', ({
    render,
    app
  }) => {
    mockHistory.mockReturnValue({
      data: [
        entry({
          designatedActionHistoryId: 30,
          event: 'EVIDENCE_REVIEWED',
          status: null,
          snapshot: {
            evidence_requirements: [
              {
                evidence_requirement_id: 1,
                requirement_number: 1,
                title: 'Permits',
                description: 'List of major permits',
                review_outcome: 'Satisfactory',
                analyst_review: 'All in hand.'
              },
              {
                evidence_requirement_id: 2,
                requirement_number: 2,
                title: null,
                description: 'Risk register',
                review_outcome: null,
                analyst_review: null
              }
            ]
          }
        })
      ],
      isLoading: false
    })
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)
    fireEvent.click(screen.getByTestId('history-entry-toggle-30'))

    const detail = screen.getByTestId('history-evidence-detail')
    expect(detail).toHaveTextContent('1. Permits')
    expect(detail).toHaveTextContent('All in hand.')
    // No title yet: the description stands in, as on the live card.
    expect(detail).toHaveTextContent('2. Risk register')
    expect(detail).toHaveTextContent('history.notReviewed')
  })

  test('names the evidence item an edit belongs to', ({ render, app }) => {
    mockHistory.mockReturnValue({
      data: [
        entry({
          designatedActionHistoryId: 40,
          event: 'DETAILS_EDITED',
          status: null,
          snapshot: {
            changed: {
              title: { from: 'Permits', to: 'Permits and approvals' }
            },
            evidence_requirement_id: 1,
            requirement_number: 1,
            requirement_title: 'Permits and approvals'
          }
        })
      ],
      isLoading: false
    })
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    // The collapsed line says which item; the detail says what changed.
    expect(screen.getByTestId('history-entry-summary-40')).toHaveTextContent(
      'history.requirementChanged'
    )
    fireEvent.click(screen.getByTestId('history-entry-toggle-40'))
    expect(screen.getByTestId('history-entry-40')).toHaveTextContent(
      'Permits and approvals'
    )
  })

  test('shows an empty state before anything has happened', ({
    render,
    app
  }) => {
    mockHistory.mockReturnValue({ data: [], isLoading: false })
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    expect(
      screen.getByText('initiativeAgreement:history.empty')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('history-entry-1')).not.toBeInTheDocument()
  })

  test('collapses the panel', ({ render, app }) => {
    render(<DesignatedActionHistoryPanel designatedActionId="1" />, app)

    const toggle = screen.getByTestId('history-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
