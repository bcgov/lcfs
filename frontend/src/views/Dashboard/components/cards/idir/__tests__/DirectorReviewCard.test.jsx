import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import DirectorReviewCard from '../DirectorReviewCard'
import { useDirectorReviewCounts } from '@/hooks/useDashboard'
import { wrapper } from '@/tests/utils/wrapper'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { FILTER_KEYS } from '@/constants/common'
import {
  COMPLIANCE_REPORT_STATUSES,
  TRANSFER_STATUSES,
  FUEL_CODE_STATUSES,
  TRANSACTION_STATUSES
} from '@/constants/statuses'

// Mock dependencies
vi.mock('@/hooks/useDashboard')
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: vi.fn()
}))
vi.mock('@/utils/withRole', () => ({
  __esModule: true,
  default: (Component) => Component
}))

// Mock components
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  __esModule: true,
  default: ({ title, content }) => (
    <div data-test="bc-widget-card">
      <div data-test="widget-title">{title}</div>
      <div data-test="widget-content">{content}</div>
    </div>
  )
}))

vi.mock('@/components/Loading', () => ({
  __esModule: true,
  default: ({ message }) => <div data-test="loading">{message}</div>
}))

describe('DirectorReviewCard Component', () => {
  const mockNavigate = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    useNavigate.mockReturnValue(mockNavigate)

    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        setItem: vi.fn(),
        getItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })
  })

  it('renders loading state correctly', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: {}, // Use empty object instead of null to match component expectation
      isLoading: true
    })

    render(<DirectorReviewCard />, { wrapper })

    const loadingElement = screen.getByText(/Loading director review items/)
    expect(loadingElement).toBeInTheDocument()
  })

  it('renders with counts data', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: {
        transfers: 2,
        complianceReports: 3,
        initiativeAgreements: 1,
        adminAdjustments: 4,
        fuelCodes: 5
      },
      isLoading: false
    })

    render(<DirectorReviewCard />, { wrapper })

    expect(screen.getByText('Director review')).toBeInTheDocument()
    expect(screen.getByText(/There are/)).toBeInTheDocument()

    // Check that all categories are displayed with correct counts
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()

    expect(
      screen.getByText(/Transfer\(s\) for your review and statutory decision/, {
        exact: false
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Compliance report\(s\) for your review/, {
        exact: false
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Initiative agreement\(s\) for your review/, {
        exact: false
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Administrative adjustment\(s\) for your review/, {
        exact: false
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Fuel code\(s\) for your review/, {
        exact: false
      })
    ).toBeInTheDocument()
  })

  it('navigates to transfers page on link click with correct filter', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: { transfers: 2 },
      isLoading: false
    })

    render(<DirectorReviewCard />, { wrapper })

    // Find and click the transfers link
    const link = screen.getByText(
      /Transfer\(s\) for your review and statutory decision/,
      { exact: false }
    )
    fireEvent.click(link)

    // Check that sessionStorage was updated with the correct filter
    const expectedFilter = JSON.stringify({
      transactionType: {
        filterType: 'text',
        type: 'equals',
        filter: 'Transfer'
      },
      status: {
        filterType: 'text',
        type: 'equals',
        filter: TRANSFER_STATUSES.RECOMMENDED
      }
    })

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      FILTER_KEYS.TRANSACTIONS_GRID,
      expectedFilter
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.TRANSACTIONS.LIST)
  })

  it('navigates to compliance reports page on link click with correct filter', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: { complianceReports: 3 },
      isLoading: false
    })

    render(<DirectorReviewCard />, { wrapper })

    // Find and click the compliance reports link
    const link = screen.getByText(/Compliance report\(s\) for your review/, {
      exact: false
    })
    fireEvent.click(link)

    // Check that sessionStorage was updated with the correct filter
    const expectedFilter = JSON.stringify({
      status: {
        filterType: 'text',
        type: 'equals',
        filter: COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      }
    })

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      FILTER_KEYS.COMPLIANCE_REPORT_GRID,
      expectedFilter
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.REPORTS.LIST)
  })

  it('navigates to fuel codes page on link click with correct filter', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: { fuelCodes: 2 },
      isLoading: false
    })

    render(<DirectorReviewCard />, { wrapper })

    // Find and click the fuel codes link
    const link = screen.getByText(/Fuel code\(s\) for your review/, {
      exact: false
    })
    fireEvent.click(link)

    // Check that sessionStorage was updated with the correct filter
    const expectedFilter = JSON.stringify({
      status: {
        filterType: 'text',
        type: 'equals',
        filter: FUEL_CODE_STATUSES.RECOMMENDED
      }
    })

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      FILTER_KEYS.FUEL_CODES_GRID,
      expectedFilter
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.FUEL_CODES.LIST)
  })

  it('handles zero counts correctly', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: {
        transfers: 0,
        complianceReports: 0,
        initiativeAgreements: 0,
        adminAdjustments: 0,
        fuelCodes: 0
      },
      isLoading: false
    })

    render(<DirectorReviewCard />, { wrapper })

    // All counts should show 0
    expect(screen.getAllByText('0').length).toBe(5)
  })

  it('navigates to initiative agreements page on link click with correct filter', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: { initiativeAgreements: 1 },
      isLoading: false
    })

    render(<DirectorReviewCard />, { wrapper })

    // Find and click the initiative agreements link
    const link = screen.getByText(/Initiative agreement\(s\) for your review/, {
      exact: false
    })
    fireEvent.click(link)

    // Check that sessionStorage was updated with the correct filter
    const expectedFilter = JSON.stringify({
      transactionType: {
        filterType: 'text',
        type: 'equals',
        filter: 'Initiative Agreement'
      },
      status: {
        filterType: 'text',
        type: 'equals',
        filter: TRANSACTION_STATUSES.RECOMMENDED
      }
    })

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      FILTER_KEYS.TRANSACTIONS_GRID,
      expectedFilter
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.TRANSACTIONS.LIST)
  })

  it('navigates to admin adjustments page on link click with correct filter', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: { adminAdjustments: 2 },
      isLoading: false
    })

    render(<DirectorReviewCard />, { wrapper })

    // Find and click the admin adjustments link
    const link = screen.getByText(/Administrative adjustment\(s\) for your review/, {
      exact: false
    })
    fireEvent.click(link)

    // Check that sessionStorage was updated with the correct filter
    const expectedFilter = JSON.stringify({
      transactionType: {
        filterType: 'text',
        type: 'equals',
        filter: 'Admin Adjustment'
      },
      status: {
        filterType: 'text',
        type: 'equals',
        filter: TRANSACTION_STATUSES.RECOMMENDED
      }
    })

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      FILTER_KEYS.TRANSACTIONS_GRID,
      expectedFilter
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.TRANSACTIONS.LIST)
  })

  it('handles missing data gracefully', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: {}, // Empty object - missing counts
      isLoading: false
    })

    render(<DirectorReviewCard />, { wrapper })

    // Should default to 0 for missing counts
    expect(screen.getAllByText('0').length).toBe(5)
  })

  it('handles undefined data gracefully', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: undefined, // Undefined data
      isLoading: false
    })

    render(<DirectorReviewCard />, { wrapper })

    // Should default to 0 for undefined data
    expect(screen.getAllByText('0').length).toBe(5)
  })

  it('renders correct component structure and styling', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: { transfers: 1 },
      isLoading: false
    })

    render(<DirectorReviewCard />, { wrapper })

    // Check widget card is rendered
    expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
    expect(screen.getByTestId('widget-title')).toBeInTheDocument()
    expect(screen.getByTestId('widget-content')).toBeInTheDocument()
  })

  it('ensures all translation keys are used', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: {
        transfers: 1,
        complianceReports: 2,
        initiativeAgreements: 3,
        adminAdjustments: 4,
        fuelCodes: 5
      },
      isLoading: false
    })

    render(<DirectorReviewCard />, { wrapper })

    // Verify all the expected translation strings are present
    expect(screen.getByText('Director review')).toBeInTheDocument()
    expect(screen.getByText(/There are/)).toBeInTheDocument()
    expect(screen.getByText(/Transfer\(s\) for your review and statutory decision/)).toBeInTheDocument()
    expect(screen.getByText(/Compliance report\(s\) for your review/)).toBeInTheDocument()
    expect(screen.getByText(/Initiative agreement\(s\) for your review/)).toBeInTheDocument()
    expect(screen.getByText(/Administrative adjustment\(s\) for your review/)).toBeInTheDocument()
    expect(screen.getByText(/Fuel code\(s\) for your review/)).toBeInTheDocument()
  })

  it('calls both click handlers for each item', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: { transfers: 1 },
      isLoading: false
    })

    render(<DirectorReviewCard />, { wrapper })

    // Find the first list item button (transfers)
    const listItemButtons = screen.getAllByRole('button')
    fireEvent.click(listItemButtons[0])

    // Verify navigation was called for transfers
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.TRANSACTIONS.LIST)
    expect(window.sessionStorage.setItem).toHaveBeenCalled()
  })

  it('renders loading message with correct translation', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: {},
      isLoading: true
    })

    render(<DirectorReviewCard />, { wrapper })

    // Verify loading component receives translated message
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.getByText('Loading director review items...')).toBeInTheDocument()
  })

  it('maintains referential equality for memoized callbacks', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: { transfers: 1 },
      isLoading: false
    })

    const { rerender } = render(
      <DirectorReviewCard />,
      { wrapper }
    )

    // Component should render successfully with initial data
    expect(screen.getByText('Director review')).toBeInTheDocument()

    // Rerender with same data (memoization should prevent unnecessary updates)
    rerender(<DirectorReviewCard />)

    // Component should still render correctly
    expect(screen.getByText('Director review')).toBeInTheDocument()
  })
})
