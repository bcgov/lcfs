import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { HistoryCard } from '@/views/ComplianceReports/components/HistoryCard.jsx'
import { wrapper } from '@/tests/utils/wrapper.jsx'

import * as useCurrentUserHook from '@/hooks/useCurrentUser'
import { displayName } from 'react-quill'
import { AssessmentCard } from '@/views/ComplianceReports/components/AssessmentCard.jsx'

// Mock useCurrentUser
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    data: { isGovernmentUser: false },
    isLoading: false
  }))
}))

// Mock timezoneFormatter
vi.mock('@/utils/formatters', () => ({
  timezoneFormatter: vi.fn(({ value }) => `formatted-${value}`)
}))

describe('HistoryCard', () => {
  const defaultReport = {
    version: 0,
    organization: {
      name: 'Test Org'
    },
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
        status: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
        createDate: '2024-10-01T10:00:00Z',
        userProfile: { firstName: 'John', lastName: 'Doe' },
        displayName: 'John Doe'
      },
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST },
        createDate: '2024-10-03T15:00:00Z',
        userProfile: { firstName: 'Jane', lastName: 'Smith' },
        displayName: 'Jane Smith'
      }
    ]
    renderComponent({
      currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED },
      history
    })

    // SUBMITTED first because 2024-10-03 is later than 2024-10-01
    await waitFor(() => {
      const items = screen.getAllByTestId('list-item')
      // The first item should be RECOMMENDED_BY_ANALYST (2024-10-03)
      expect(items[0].textContent).toContain(
        'Recommended formatted-2024-10-03T15:00:00Z by Jane Smith.'
      )
      // The second item should be SUBMITTED (2024-10-01)
      expect(items[1].textContent).toContain(
        'Signed and submitted formatted-2024-10-01T10:00:00Z by John Doe.'
      )
    })
  })

  it('replaces ASSESSED with AssessedBy if user is not government', async () => {
    const history = [
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
        createDate: '2024-10-01T10:00:00Z',
        userProfile: { firstName: 'John', lastName: 'Doe' },
        displayName: 'John Doe'
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
        'Assessed formatted-2024-10-01T10:00:00Z by the director under the Low Carbon Fuels Act.'
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
        userProfile: { firstName: 'John', lastName: 'Doe' },
        displayName: 'John Doe'
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
        'Assessed formatted-2024-10-01T10:00:00Z by the director under the Low Carbon Fuels Act.'
      )
    })
  })

  it('renders has met in report history for meeting reports', async () => {
    useCurrentUserHook.useCurrentUser.mockReturnValueOnce({
      data: { isGovernmentUser: true },
      isLoading: false
    })
    const history = [
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
        createDate: '2024-10-01T10:00:00Z',
        userProfile: { firstName: 'John', lastName: 'Doe' },
        displayName: 'John Doe'
      }
    ]
    renderComponent({
      currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
      history,
      summary: {
        line11FossilDerivedBaseFuelTotal: 0.0,
        line21NonCompliancePenaltyPayable: 0.0
      }
    })

    await waitFor(() => {
      expect(
        screen.getByText(
          'Test Org has met renewable fuel targets set under section 9 of the Low Carbon Fuels Act.'
        )
      ).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(
        screen.getByText(
          'Test Org has met the low carbon fuel targets set under section 12 of the Low Carbon Fuels Act.'
        )
      ).toBeInTheDocument()
    })
  })

  it('renders has not met in report history for reports', async () => {
    useCurrentUserHook.useCurrentUser.mockReturnValueOnce({
      data: { isGovernmentUser: true },
      isLoading: false
    })
    const history = [
      {
        status: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
        createDate: '2024-10-01T10:00:00Z',
        userProfile: { firstName: 'John', lastName: 'Doe' },
        displayName: 'John Doe'
      }
    ]
    renderComponent({
      currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED },
      history,
      summary: {
        line11FossilDerivedBaseFuelTotal: 1.0,
        line21NonCompliancePenaltyPayable: 1.0
      }
    })

    await waitFor(() => {
      expect(
        screen.getByText(
          'Test Org has not met renewable fuel targets set under section 9 of the Low Carbon Fuels Act.'
        )
      ).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(
        screen.getByText(
          'Test Org has not met the low carbon fuel targets set under section 12 of the Low Carbon Fuels Act.'
        )
      ).toBeInTheDocument()
    })
  })
})
