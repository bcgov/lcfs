import React, { createRef } from 'react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { NewComplianceReportButton } from '../NewComplianceReportButton'
import { test } from '@/tests/utils/fixtures'
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

  test('renders the primary button and forwards refs', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const ref = createRef()

    render(<NewComplianceReportButton {...getDefaultProps()} ref={ref} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByRole('button')).toHaveTextContent('report:newReportBtn')
    expect(ref.current).not.toBeNull()
  })

  test('opens the menu and lists available years that are ready', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<NewComplianceReportButton {...getDefaultProps()} />, [
      query,
      theme,
      localization,
      router
    ])

    fireEvent.click(screen.getByRole('button'))

    const menu = await screen.findByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.queryByText('2025')).not.toBeInTheDocument()
  })

  test('disables periods that have already been reported', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHooks({
      reportedPeriods: [{ compliancePeriodId: 1 }]
    })

    render(<NewComplianceReportButton {...getDefaultProps()} />, [
      query,
      theme,
      localization,
      router
    ])
    fireEvent.click(screen.getByRole('button'))

    const menuItem = await screen.findByText('2024')
    expect(menuItem).toHaveAttribute('aria-disabled', 'true')
  })

  test('calls handlers when a period is selected', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<NewComplianceReportButton {...getDefaultProps()} />, [
      query,
      theme,
      localization,
      router
    ])
    fireEvent.click(screen.getByRole('button'))

    const option = await screen.findByText('2024')
    fireEvent.click(option)

    expect(setIsButtonLoadingMock).toHaveBeenCalledWith(true)
    expect(handleNewReportMock).toHaveBeenCalledWith(
      expect.objectContaining({ compliancePeriodId: 1 })
    )
  })

  test('shows an informational message when no periods are available', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHooks({
      periods: {
        data: [],
        isLoading: false,
        isFetched: true
      }
    })

    render(<NewComplianceReportButton {...getDefaultProps()} />, [
      query,
      theme,
      localization,
      router
    ])
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('report:noReportsFound')).toBeInTheDocument()
    })
  })

  test('does not render the menu when data has not finished loading', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHooks({
      periods: { data: basePeriods, isLoading: false, isFetched: false }
    })

    render(<NewComplianceReportButton {...getDefaultProps()} />, [
      query,
      theme,
      localization,
      router
    ])
    fireEvent.click(screen.getByRole('button'))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
