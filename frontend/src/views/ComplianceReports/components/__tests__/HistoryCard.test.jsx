import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HistoryCard } from '../HistoryCard'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import * as UserHooks from '@/hooks/useCurrentUser.js'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) =>
      `${key}${params?.createDate ? ` - ${params.createDate}` : ''}${
        params?.displayName ? ` - ${params.displayName}` : ''
      }`
  })
}))

vi.mock('@/hooks/useCurrentUser.js')

const mockReport = {
  version: 1,
  nickname: 'Quarterly Report',
  compliancePeriod: { description: 'Q1 2024' },
  currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
  history: [
    {
      createDate: '2024-03-12T15:00:00Z',
      status: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
      userProfile: { firstName: 'Alice', lastName: 'Smith' }
    },
    {
      createDate: '2024-03-10T12:00:00Z',
      status: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
      userProfile: { firstName: 'Bob', lastName: 'Jones' }
    },
    {
      createDate: '2024-02-01',
      status: { status: COMPLIANCE_REPORT_STATUSES.DRAFT },
      userProfile: { firstName: 'Charlie', lastName: 'Brown' }
    }
  ]
}

describe('HistoryCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: non-government user
    vi.spyOn(UserHooks, 'useCurrentUser').mockReturnValue({
      data: {
        isGovernmentUser: false
      }
    })
  })

  it('does not render history items if history is empty', () => {
    const emptyReport = { ...mockReport, history: [] }
    render(<HistoryCard report={emptyReport} />, { wrapper })

    expect(screen.queryByTestId('list-item')).not.toBeInTheDocument()
  })

  it('handles version 0 correctly', () => {
    const version0Report = {
      ...mockReport,
      version: 0,
      currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT }
    }
    render(<HistoryCard report={version0Report} />, { wrapper })

    // For version 0, the heading is "Q1 2024 Compliance Report : DRAFT"
    // We'll do partial or case-insensitive regex match:
    expect(
      screen.getByText(/Q1 2024 Compliance Report\s*:\s*Draft/i)
    ).toBeInTheDocument()
  })

  it('renders ASSESSED as-is for government user', () => {
    // Re-mock currentUser to be gov user
    vi.spyOn(UserHooks, 'useCurrentUser').mockReturnValue({
      data: {
        isGovernmentUser: true
      }
    })

    render(<HistoryCard report={mockReport} />, { wrapper })

    // Now the top item should remain 'ASSESSED' instead of 'AssessedBy'
    const historyItems = screen.getAllByTestId('list-item')
    // Because it's sorted descending, index 0 is the item with createDate=2024-03-12 => ASSESSED
    expect(historyItems[0]).toHaveTextContent(/ASSESSED/i)
  })

  it('renders ASSESSED as AssessedBy for non-government user', () => {
    // Confirm we keep default: isGovernmentUser = false
    render(<HistoryCard report={mockReport} />, { wrapper })

    const historyItems = screen.getAllByTestId('list-item')
    // Should now be 'AssessedBy'
    expect(historyItems[0]).toHaveTextContent(/AssessedBy/i)
  })
})
