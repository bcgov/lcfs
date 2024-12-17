import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { HistoryCard } from '@/views/ComplianceReports/components/HistoryCard.jsx'
import { wrapper } from '@/tests/utils/wrapper.jsx'

import * as useCurrentUserHook from '@/hooks/useCurrentUser'

// Mock useCurrentUser
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    data: { isGovernmentUser: false },
    isLoading: false
  }))
}))

// Mock translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (opts && opts.createDate && opts.firstName && opts.lastName) {
        return `${key}: ${opts.firstName} ${opts.lastName} - ${opts.createDate}`
      }
      return key
    }
  })
}))

// Mock timezoneFormatter
vi.mock('@/utils/formatters', () => ({
  timezoneFormatter: vi.fn(({ value }) => `formatted-${value}`)
}))

describe('HistoryCard', () => {
  const defaultReport = {
    version: 0,
    compliancePeriod: { description: '2024' },
    nickname: 'My Nickname',
    currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT },
    history: []
  }

  const renderComponent = (overrides = {}) => {
    return render(<HistoryCard report={{ ...defaultReport, ...overrides }} />, {
      wrapper
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without history', async () => {
    renderComponent()
    // Only the accordion header should be present
    await waitFor(() => {
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    })
  })

  it('displays compliancePeriod.description and current status if version=0', async () => {
    renderComponent({
      currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
    })
    await waitFor(() => {
      expect(
        screen.getByText(/2024 Compliance Report: SUBMITTED/i)
      ).toBeInTheDocument()
    })
  })

  it('displays nickname and current status if version > 0', async () => {
    renderComponent({
      version: 1,
      nickname: 'My Cool Nickname',
      currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
    })
    await waitFor(() => {
      expect(
        screen.getByText(/My Cool Nickname: SUBMITTED/i)
      ).toBeInTheDocument()
    })
  })

  it('sorts history in descending order by createDate and filters out DRAFT', async () => {
    const history = [
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.DRAFT },
        createDate: '2024-10-02',
        userProfile: { firstName: 'Draft', lastName: 'User' }
      },
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
        createDate: '2024-10-01T10:00:00Z',
        userProfile: { firstName: 'John', lastName: 'Doe' }
      },
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST },
        createDate: '2024-10-03T15:00:00Z',
        userProfile: { firstName: 'Jane', lastName: 'Smith' }
      }
    ]
    renderComponent({
      currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
      history
    })

    // SUBMITTED first because 2024-10-03 is later than 2024-10-01
    await waitFor(() => {
      const items = screen.getAllByTestId('list-item')
      expect(items.length).toBe(2) // DRAFT is filtered out
      // The first item should be RECOMMENDED_BY_ANALYST (2024-10-03)
      expect(items[0].textContent).toContain(
        'report:complianceReportHistory.Recommended by analyst: Jane Smith'
      )
      // The second item should be SUBMITTED (2024-10-01)
      expect(items[1].textContent).toContain(
        'report:complianceReportHistory.Submitted: John Doe'
      )
    })
  })

  it('replaces ASSESSED with AssessedBy if user is not government', async () => {
    const history = [
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
        createDate: '2024-10-01T10:00:00Z',
        userProfile: { firstName: 'John', lastName: 'Doe' }
      }
    ]
    renderComponent({
      currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
      history
    })

    await waitFor(() => {
      const item = screen.getByTestId('list-item')
      // Should have replaced ASSESSED with AssessedBy
      expect(item.textContent).toContain(
        'report:complianceReportHistory.AssessedBy: John Doe - formatted-2024-10-01T10:00:00Z'
      )
    })
  })

  it('does not replace ASSESSED with AssessedBy if user is government', async () => {
    useCurrentUserHook.useCurrentUser.mockReturnValueOnce({
      data: { isGovernmentUser: true },
      isLoading: false
    })
    const history = [
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
        createDate: '2024-10-01T10:00:00Z',
        userProfile: { firstName: 'John', lastName: 'Doe' }
      }
    ]
    renderComponent({
      currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
      history
    })

    await waitFor(() => {
      const item = screen.getByTestId('list-item')
      // Should NOT have replaced ASSESSED with AssessedBy
      expect(item.textContent).toContain(
        'report:complianceReportHistory.Assessed: John Doe - formatted-2024-10-01T10:00:00Z'
      )
    })
  })
})
