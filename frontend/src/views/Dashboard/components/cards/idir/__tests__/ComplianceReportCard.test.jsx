import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ComplianceReportCard } from '../ComplianceReportCard'
import { useComplianceReportCounts } from '@/hooks/useDashboard'
import { wrapper } from '@/tests/utils/wrapper'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { FILTER_KEYS } from '@/constants/common'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// Mock dependencies
vi.mock('@/hooks/useDashboard')
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: vi.fn()
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

describe('ComplianceReportCard Component', () => {
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
    useComplianceReportCounts.mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<ComplianceReportCard />, { wrapper })

    const loadingElement = screen.getByText(/Loading.*card/, { exact: false })
    expect(loadingElement).toBeInTheDocument()
  })

  it('renders with counts data', () => {
    useComplianceReportCounts.mockReturnValue({
      data: { pendingReviews: 5 },
      isLoading: false
    })

    render(<ComplianceReportCard />, { wrapper })

    expect(screen.getByText('Compliance reports')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText(/There are/)).toBeInTheDocument()
    expect(
      screen.getByText(/Compliance Report\(s\) in progress/)
    ).toBeInTheDocument()
  })

  it('navigates to reports page on link click with correct filter', () => {
    useComplianceReportCounts.mockReturnValue({
      data: { pendingReviews: 5 },
      isLoading: false
    })

    render(<ComplianceReportCard />, { wrapper })

    // Find and click the link
    const link = screen.getByText(/Compliance Report\(s\) in progress/, {
      exact: false
    })
    fireEvent.click(link)

    // Check that sessionStorage was updated with the correct filter
    const expectedFilter = {
      status: {
        filterType: 'set',
        type: 'set',
        filter: [
          COMPLIANCE_REPORT_STATUSES.SUBMITTED,
          COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST,
          COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER,
          COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
        ]
      }
    }

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      FILTER_KEYS.COMPLIANCE_REPORT_GRID,
      JSON.stringify(expectedFilter)
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.REPORTS.LIST)
  })

  it('handles zero counts correctly', () => {
    useComplianceReportCounts.mockReturnValue({
      data: { pendingReviews: 0 },
      isLoading: false
    })

    render(<ComplianceReportCard />, { wrapper })

    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
