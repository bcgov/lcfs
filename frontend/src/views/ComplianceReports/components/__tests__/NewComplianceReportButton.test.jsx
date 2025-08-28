import React, { createRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act
} from '@testing-library/react'
import { NewComplianceReportButton } from '../NewComplianceReportButton'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import { useCompliancePeriod } from '@/hooks/useComplianceReports'
import { useGetOrgComplianceReportReportedYears } from '@/hooks/useOrganization'

// Mock translation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
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

  const currentYear = new Date().getFullYear()
  const mockPeriodsData = [
    {
      compliancePeriodId: 1,
      description: '2024',
      effectiveDate: '2024-01-01T00:00:00Z'
    },
    {
      compliancePeriodId: 2,
      description: '2025',
      effectiveDate: '2025-01-01T00:00:00Z'
    },
    {
      compliancePeriodId: 3,
      description: '2026',
      effectiveDate: '2026-01-01T00:00:00Z'
    }
  ]

  const setupMocks = (overrides = {}) => {
    const defaults = {
      periods: { data: mockPeriodsData, isLoading: false, isFetched: true },
      reportedPeriods: []
    }

    const config = { ...defaults, ...overrides }

    useCompliancePeriodMock.mockReturnValue({
      data: config.periods.data,
      isLoading: config.periods.isLoading,
      isFetched: config.periods.isFetched
    })

    useGetOrgComplianceReportReportedYearsMock.mockReturnValue({
      data: config.reportedPeriods
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    handleNewReportMock = vi.fn()
    setIsButtonLoadingMock = vi.fn()
    setupMocks()
  })

  const defaultProps = {
    handleNewReport: handleNewReportMock,
    isButtonLoading: false,
    setIsButtonLoading: setIsButtonLoadingMock
  }

  describe('Component Rendering', () => {
    it('renders button with correct initial state', () => {
      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.getByText('report:newReportBtn')).toBeInTheDocument()
    })

    it('shows loading state when isLoading is true', () => {
      setupMocks({
        periods: { data: mockPeriodsData, isLoading: true, isFetched: false }
      })

      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('shows loading state when isButtonLoading is true', () => {
      render(
        <NewComplianceReportButton {...defaultProps} isButtonLoading={true} />,
        { wrapper }
      )

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('forwards ref correctly', () => {
      const ref = createRef()

      render(<NewComplianceReportButton {...defaultProps} ref={ref} />, {
        wrapper
      })

      expect(ref.current).toBeTruthy()
    })
  })

  describe('Menu Functionality', () => {
    it('opens menu when button is clicked', async () => {
      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })
    })

    it('shows menu when button is clicked', async () => {
      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })
    })

    it('does not render menu when not fetched', () => {
      setupMocks({
        periods: { data: mockPeriodsData, isLoading: false, isFetched: false }
      })

      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('does not render menu when button is loading', () => {
      render(
        <NewComplianceReportButton {...defaultProps} isButtonLoading={true} />,
        { wrapper }
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  describe('filteredDates Function', () => {
    it('filters periods by current year and 2024+ constraint', async () => {
      const testPeriods = [
        {
          compliancePeriodId: 1,
          description: '2023',
          effectiveDate: '2024-01-01T08:00:00Z' // Will be 2023 in local time (UTC-8)
        },
        {
          compliancePeriodId: 2,
          description: '2025',
          effectiveDate: '2025-01-01T08:00:00Z' // Will be 2024 in local time
        },
        {
          compliancePeriodId: 3,
          description: '2026',
          effectiveDate: '2026-01-01T08:00:00Z' // Will be 2025 in local time (current year)
        },
        {
          compliancePeriodId: 4,
          description: `${currentYear + 2}`,
          effectiveDate: `${currentYear + 2}-01-01T08:00:00Z` // Will be currentYear + 1 in local time
        }
      ]

      setupMocks({
        periods: { data: testPeriods, isLoading: false, isFetched: true }
      })

      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      // Should show periods where effectiveYear (local) is <= currentYear and >= 2024
      expect(screen.getByText('2023')).toBeInTheDocument() // effectiveYear = 2024, shows (>= 2024 and <= 2025)
      expect(screen.getByText('2025')).toBeInTheDocument() // effectiveYear = 2025 (currentYear), shows
      expect(screen.queryByText('2026')).not.toBeInTheDocument() // effectiveYear = 2026 (> currentYear), filtered out
      expect(screen.queryByText(`${currentYear + 2}`)).not.toBeInTheDocument() // effectiveYear = currentYear + 3, filtered out
    })

    it('handles periods data structure safely - nested data', async () => {
      useCompliancePeriodMock.mockReturnValue({
        data: { data: mockPeriodsData },
        isLoading: false,
        isFetched: true
      })

      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      expect(screen.getByText('2025')).toBeInTheDocument()
    })

    it('handles periods data structure safely - null data', async () => {
      setupMocks({
        periods: { data: null, isLoading: false, isFetched: true }
      })

      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })
    })

    it('handles periods as direct array', async () => {
      useCompliancePeriodMock.mockReturnValue({
        data: mockPeriodsData,
        isLoading: false,
        isFetched: true
      })

      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      expect(screen.getByText('2025')).toBeInTheDocument()
    })
  })

  describe('Menu Item States', () => {
    it('disables menu items for reported periods', async () => {
      const reportedPeriods = [{ compliancePeriodId: 2 }] // 2025 period
      setupMocks({ reportedPeriods })

      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      const menuItems = within(screen.getByRole('menu')).getAllByRole(
        'menuitem'
      )
      const reportedItem = menuItems.find((item) => item.textContent === '2025')
      expect(reportedItem).toHaveAttribute('aria-disabled', 'true')
    })

    it('disables 2025 menu item', async () => {
      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      const menuItems = within(screen.getByRole('menu')).getAllByRole(
        'menuitem'
      )
      const item2025 = menuItems.find((item) => item.textContent === '2025')
      expect(item2025).toHaveAttribute('aria-disabled', 'true')
    })

    it('enables available periods', async () => {
      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      const menuItems = within(screen.getByRole('menu')).getAllByRole(
        'menuitem'
      )
      const availableItem = menuItems.find(
        (item) => item.textContent === '2026'
      )
      expect(availableItem).not.toHaveAttribute('aria-disabled')
    })
  })

  describe('Menu Item Selection', () => {
    it('renders clickable menu items', async () => {
      setupMocks({ reportedPeriods: [] })

      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      const menuItems = within(screen.getByRole('menu')).getAllByRole(
        'menuitem'
      )
      const item2026 = menuItems.find((item) => item.textContent === '2026')

      expect(item2026).toBeInTheDocument()
      expect(item2026).not.toHaveAttribute('aria-disabled')
    })
  })

  describe('Information Bulletin', () => {
    it('renders information bulletin box', async () => {
      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })

      expect(
        screen.getByText(
          '2025 reporting is temporarily unavailable due to regulatory updates'
        )
      ).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty reportedPeriods safely', async () => {
      setupMocks({ reportedPeriods: null })

      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })
    })

    it('handles undefined reportedPeriods safely', async () => {
      useGetOrgComplianceReportReportedYearsMock.mockReturnValue({
        data: undefined
      })

      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })
    })

    it('handles empty periods array', async () => {
      setupMocks({
        periods: { data: [], isLoading: false, isFetched: true }
      })

      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      const button = screen.getByRole('button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
      })
    })
  })

  describe('Translation Integration', () => {
    it('uses translation key for button text', () => {
      render(<NewComplianceReportButton {...defaultProps} />, { wrapper })

      expect(screen.getByText('report:newReportBtn')).toBeInTheDocument()
    })
  })
})
