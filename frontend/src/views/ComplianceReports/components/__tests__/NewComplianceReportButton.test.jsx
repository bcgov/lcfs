import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within
} from '@testing-library/react'
import { NewComplianceReportButton } from '../NewComplianceReportButton'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import { useCompliancePeriod } from '@/hooks/useComplianceReports'
import { useGetOrgComplianceReportReportedYears } from '@/hooks/useOrganization'

// Mock translation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key // simple passthrough for testing
  })
}))

// Mock hooks
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
  let handleNewReportMock, setIsButtonLoadingMock

  beforeEach(() => {
    vi.clearAllMocks()
    handleNewReportMock = vi.fn()
    setIsButtonLoadingMock = vi.fn()

    // Provide two periods in the expected nested structure.
    useCompliancePeriodMock.mockReturnValue({
      data: {
        data: [
          {
            compliancePeriodId: 1,
            description: '2024 Compliance Period',
            effectiveDate: '2024-02-02'
          },
          {
            compliancePeriodId: 2,
            description: '2025 Compliance Period',
            effectiveDate: '2025-02-02'
          }
        ]
      },
      isLoading: false,
      isFetched: true
    })

    // For most tests, simulate that the 2024 period is already reported.
    useGetOrgComplianceReportReportedYearsMock.mockReturnValue({
      data: [{ compliancePeriodId: 1 }]
    })
  })

  it('renders the button correctly', () => {
    render(
      <NewComplianceReportButton
        handleNewReport={handleNewReportMock}
        isButtonLoading={false}
        setIsButtonLoading={setIsButtonLoadingMock}
      />,
      { wrapper }
    )
    const button = screen.getByRole('button', { name: /report:newReportBtn/i })
    expect(button).toBeInTheDocument()
  })

  it('opens the menu when button is clicked and shows filtered options', async () => {
    render(
      <NewComplianceReportButton
        handleNewReport={handleNewReportMock}
        isButtonLoading={false}
        setIsButtonLoading={setIsButtonLoadingMock}
      />,
      { wrapper }
    )
    const button = screen.getByRole('button', { name: /report:newReportBtn/i })
    fireEvent.click(button)

    // Wait for the menu to appear.
    const menu = await screen.findByRole('menu')
    const menuItems = within(menu).getAllByRole('menuitem')
    // The filtering function should return only the period with effectiveDate in 2024 and 2025.
    expect(menuItems).toHaveLength(2)
    expect(menuItems[0]).toHaveTextContent('2024 Compliance Period')
    expect(menuItems[1]).toHaveTextContent('2025 Compliance Period')
  })

  it('disables already reported periods', async () => {
    render(
      <NewComplianceReportButton
        handleNewReport={handleNewReportMock}
        isButtonLoading={false}
        setIsButtonLoading={setIsButtonLoadingMock}
      />,
      { wrapper }
    )
    const button = screen.getByRole('button', { name: /report:newReportBtn/i })
    fireEvent.click(button)

    const menu = await screen.findByRole('menu')
    // Use a flexible matcher in case the text is split.
    const menuItem = within(menu).getByText((content) =>
      content.includes('2024 Compliance Period')
    )
    expect(menuItem.closest('li')).toHaveAttribute('aria-disabled', 'true')
  })

  it('calls handleNewReport when clicking a valid period', async () => {
    // For this test, simulate that no periods are reported so that the 2024 option is active.
    useGetOrgComplianceReportReportedYearsMock.mockReturnValueOnce({
      data: []
    })

    render(
      <NewComplianceReportButton
        handleNewReport={handleNewReportMock}
        isButtonLoading={false}
        setIsButtonLoading={setIsButtonLoadingMock}
      />,
      { wrapper }
    )
    const button = screen.getByRole('button', { name: /report:newReportBtn/i })
    fireEvent.click(button)

    const menu = await screen.findByRole('menu')
    const menuItem = within(menu).getByText((content) =>
      content.includes('2024 Compliance Period')
    )
    fireEvent.click(menuItem)

    await waitFor(() => {
      expect(setIsButtonLoadingMock).toHaveBeenCalledWith(true)
    })
  })

  it('does not open menu when button is in loading state', () => {
    render(
      <NewComplianceReportButton
        handleNewReport={handleNewReportMock}
        isButtonLoading={true}
        setIsButtonLoading={setIsButtonLoadingMock}
      />,
      { wrapper }
    )
    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('displays loading state on button if isLoading from hook is true', () => {
    useCompliancePeriodMock.mockReturnValueOnce({
      data: null,
      isLoading: true,
      isFetched: false
    })
    render(
      <NewComplianceReportButton
        handleNewReport={handleNewReportMock}
        isButtonLoading={false}
        setIsButtonLoading={setIsButtonLoadingMock}
      />,
      { wrapper }
    )
    // Instead of checking for disabled state on the button, verify that a progress indicator appears.
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
