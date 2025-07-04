import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityLinksList } from '../ActivityLinksList'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import { useNavigate, useParams } from 'react-router-dom'
import { useApiService } from '@/services/useApiService'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { dateToLongString } from '@/utils/formatters'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
    useParams: vi.fn()
  }
})

vi.mock('@/services/useApiService')
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/utils/dateQuarterUtils', () => ({
  getQuarterDateRange: (quarter, year) => {
    const ranges = {
      Q1: { from: `${year}-01-01`, to: `${year}-03-31` },
      Q2: { from: `${year}-01-01`, to: `${year}-06-30` },
      Q3: { from: `${year}-01-01`, to: `${year}-09-30` },
      Q4: { from: `${year}-01-01`, to: `${year}-12-31` }
    }
    return ranges[quarter]
  }
}))
vi.mock('@/utils/formatters', () => ({
  dateToLongString: (date) => {
    const d = new Date(date)
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    }
    return new Intl.DateTimeFormat('en-US', options).format(d)
  }
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

describe('ActivityLinksList', () => {
  let mockNavigate
  let mockDownload

  beforeEach(() => {
    vi.clearAllMocks()

    mockNavigate = vi.fn()
    mockDownload = vi.fn()

    useNavigate.mockReturnValue(mockNavigate)
    useParams.mockReturnValue({
      compliancePeriod: '2025',
      complianceReportId: '123'
    })
    useApiService.mockReturnValue({
      download: mockDownload
    })
    useCurrentUser.mockReturnValue({
      data: {
        organization: { name: 'Test Org' }
      }
    })
  })

  describe('Annual Report', () => {
    it('renders all activity links', () => {
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={false}
          reportQuarter={null}
        />,
        { wrapper }
      )
      expect(screen.queryByText(/Did Test Org engage/)).not.toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.supplyOfFuel')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.notionalTransfers')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.fuelsOtherUse')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.exportFuels')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.finalSupplyEquipment')
      ).toBeInTheDocument()
    })
  })

  describe('Quarterly Report (Q1-Q3)', () => {
    it('renders correct text and filtered links for Q2', () => {
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={true}
          reportQuarter={2}
        />,
        { wrapper }
      )
      const expectedText = screen.getByText((content, element) => {
        const hasText = (node) =>
          node.textContent ===
          'Did Test Org engage in any of the following activities between January 1, 2025 and June 30, 2025?'
        const nodeHasText = hasText(element)
        const childrenDontHaveText = Array.from(element.children).every(
          (child) => !hasText(child)
        )
        return nodeHasText && childrenDontHaveText
      })
      expect(expectedText).toBeInTheDocument()
      const orgNameElement = screen.getByText('Test Org')
      expect(orgNameElement).toHaveStyle('font-weight: bold')

      expect(
        screen.getByText('report:activityLists.supplyOfFuel')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.notionalTransfers')
      ).toBeInTheDocument()
      expect(
        screen.queryByText('report:activityLists.fuelsOtherUse')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('report:activityLists.exportFuels')
      ).not.toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.finalSupplyEquipment')
      ).toBeInTheDocument()
    })
  })

  describe('Quarterly Report (Q4)', () => {
    it('renders all activity links for Q4', () => {
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={true}
          reportQuarter={4}
        />,
        { wrapper }
      )
      const expectedText = screen.getByText((content, element) => {
        const hasText = (node) =>
          node.textContent ===
          'Did Test Org engage in any of the following activities between January 1, 2025 and December 31, 2025?'
        const nodeHasText = hasText(element)
        const childrenDontHaveText = Array.from(element.children).every(
          (child) => !hasText(child)
        )
        return nodeHasText && childrenDontHaveText
      })
      expect(expectedText).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.supplyOfFuel')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.notionalTransfers')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.fuelsOtherUse')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.exportFuels')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.finalSupplyEquipment')
      ).toBeInTheDocument()
    })
  })

  it('navigates correctly when an activity is clicked', async () => {
    const user = userEvent.setup()
    render(<ActivityLinksList currentStatus="Draft" />, { wrapper })
    await user.click(screen.getByText('report:activityLists.supplyOfFuel'))
    expect(mockNavigate).toHaveBeenCalledWith(
      '/compliance-reporting/2025/123/supply-of-fuel'
    )
  })

  it('triggers report download when download button is clicked', async () => {
    const user = userEvent.setup()
    render(<ActivityLinksList currentStatus="Draft" />, { wrapper })
    await user.click(screen.getByTestId('download-report'))
    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith({
        url: '/reports/123/export'
      })
    })
  })
})
