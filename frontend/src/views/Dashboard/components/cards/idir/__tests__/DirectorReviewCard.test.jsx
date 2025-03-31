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
  TRANSFER_STATUSES
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
    <div data-testid="bc-widget-card">
      <div data-testid="widget-title">{title}</div>
      <div data-testid="widget-content">{content}</div>
    </div>
  )
}))

vi.mock('@/components/Loading', () => ({
  __esModule: true,
  default: ({ message }) => <div data-testid="loading">{message}</div>
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
        adminAdjustments: 4
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

    expect(
      screen.getByText(/Transfer\(s\) for your review and statutory decision/, {
        exact: false
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Compliance report\(s\) awaiting your review/, {
        exact: false
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Initiative agreement\(s\) awaiting your review/, {
        exact: false
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Administrative adjustment\(s\) awaiting your review/, {
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
    const link = screen.getByText(
      /Compliance report\(s\) awaiting your review/,
      { exact: false }
    )
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

  it('handles zero counts correctly', () => {
    useDirectorReviewCounts.mockReturnValue({
      data: {
        transfers: 0,
        complianceReports: 0,
        initiativeAgreements: 0,
        adminAdjustments: 0
      },
      isLoading: false
    })

    render(<DirectorReviewCard />, { wrapper })

    // All counts should show 0
    expect(screen.getAllByText('0').length).toBe(4)
  })
})
