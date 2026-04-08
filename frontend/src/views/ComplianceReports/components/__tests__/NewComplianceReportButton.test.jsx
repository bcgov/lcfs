import React, { createRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NewComplianceReportButton } from '../NewComplianceReportButton'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import { useCompliancePeriod } from '@/hooks/useComplianceReports'
import { useGetOrgComplianceReportReportedYears } from '@/hooks/useOrganization'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useCompliancePeriod: vi.fn()
}))

vi.mock('@/hooks/useOrganization', () => ({
  useGetOrgComplianceReportReportedYears: vi.fn()
}))

const useCompliancePeriodMock = useCompliancePeriod
const useGetOrgComplianceReportReportedYearsMock =
  useGetOrgComplianceReportReportedYears

describe('NewComplianceReportButton', () => {
  const basePeriods = [
    {
      compliancePeriodId: 1,
      description: '2024',
      effectiveDate: '2024-01-01T00:00:00Z'
    }
  ]

  const mockHooks = ({
    periods = { data: basePeriods, isLoading: false, isFetched: true },
    reportedPeriods = []
  } = {}) => {
    useCompliancePeriodMock.mockReturnValue({
      data: periods.data,
      isLoading: periods.isLoading,
      isFetched: periods.isFetched
    })

    useGetOrgComplianceReportReportedYearsMock.mockReturnValue({
      data: reportedPeriods
    })
  }

  let handleNewReportMock
  let setIsButtonLoadingMock

  beforeEach(() => {
    vi.clearAllMocks()
    handleNewReportMock = vi.fn()
    setIsButtonLoadingMock = vi.fn()
    mockHooks()
  })

  const getDefaultProps = () => ({
    handleNewReport: handleNewReportMock,
    isButtonLoading: false,
    setIsButtonLoading: setIsButtonLoadingMock
  })

  it('renders the primary button and forwards refs', () => {
    const ref = createRef()

    render(<NewComplianceReportButton {...getDefaultProps()} ref={ref} />, {
      wrapper
    })

    expect(screen.getByRole('button')).toHaveTextContent('report:newReportBtn')
    expect(ref.current).not.toBeNull()
  })

  it('opens the menu and lists available years that are ready', async () => {
    render(<NewComplianceReportButton {...getDefaultProps()} />, { wrapper })

    fireEvent.click(screen.getByRole('button'))

    const menu = await screen.findByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.queryByText('2025')).not.toBeInTheDocument()
  })

  it('disables periods that have already been reported', async () => {
    mockHooks({
      reportedPeriods: [{ compliancePeriodId: 1 }]
    })

    render(<NewComplianceReportButton {...getDefaultProps()} />, { wrapper })
    fireEvent.click(screen.getByRole('button'))

    const menuItem = await screen.findByText('2024')
    expect(menuItem).toHaveAttribute('aria-disabled', 'true')
  })

  it('calls handlers when a period is selected', async () => {
    render(<NewComplianceReportButton {...getDefaultProps()} />, { wrapper })
    fireEvent.click(screen.getByRole('button'))

    const option = await screen.findByText('2024')
    fireEvent.click(option)

    expect(setIsButtonLoadingMock).toHaveBeenCalledWith(true)
    expect(handleNewReportMock).toHaveBeenCalledWith(
      expect.objectContaining({ compliancePeriodId: 1 })
    )
  })

  it('shows an informational message when no periods are available', async () => {
    mockHooks({
      periods: {
        data: [],
        isLoading: false,
        isFetched: true
      }
    })

    render(<NewComplianceReportButton {...getDefaultProps()} />, { wrapper })
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('report:noReportsFound')).toBeInTheDocument()
    })
  })

  it('does not render the menu when data has not finished loading', () => {
    mockHooks({
      periods: { data: basePeriods, isLoading: false, isFetched: false }
    })

    render(<NewComplianceReportButton {...getDefaultProps()} />, { wrapper })
    fireEvent.click(screen.getByRole('button'))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
