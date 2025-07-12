import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityLinksList } from '../ActivityLinksList'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import { useNavigate, useParams } from 'react-router-dom'
import { useApiService } from '@/services/useApiService'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
    useParams: vi.fn()
  }
})

vi.mock('@/services/useApiService')

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
      compliancePeriod: '2024',
      complianceReportId: '12345'
    })
    useApiService.mockReturnValue({
      download: mockDownload
    })
  })

  it('renders primary and secondary lists with correct items', () => {
    render(<ActivityLinksList currentStatus="Draft" />, { wrapper })

    expect(screen.getByText('report:activityLinksList:')).toBeInTheDocument()
    expect(screen.getByText('report:activitySecondList:')).toBeInTheDocument()

    expect(
      screen.getByText(/report:activityLists\.supplyOfFuel/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/report:activityLists\.uploadDocuments/i)
    ).toBeInTheDocument()
  })

  it('navigates correctly when primary activity is clicked', async () => {
    const user = userEvent.setup()

    render(<ActivityLinksList currentStatus="Draft" />, { wrapper })

    await user.click(screen.getByText(/report:activityLists\.supplyOfFuel/i))

    expect(mockNavigate).toHaveBeenCalledWith(
      '/compliance-reporting/2024/12345/supply-of-fuel'
    )
  })

  it('triggers report download when download button is clicked', async () => {
    const user = userEvent.setup()

    render(<ActivityLinksList currentStatus="Draft" />, { wrapper })

    await user.click(screen.getByTestId('download-report'))

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith({
        url: '/reports/12345/export'
      })
    })
  })

  it('does not render download section when status is not DRAFT', () => {
    render(<ActivityLinksList currentStatus="Submitted" />, { wrapper })

    expect(screen.queryByTestId('download-report')).not.toBeInTheDocument()
  })
})
