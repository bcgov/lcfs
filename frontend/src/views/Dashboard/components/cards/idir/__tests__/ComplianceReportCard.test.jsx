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

// Mock react-i18next to capture translation calls
const mockT = vi.fn((key) => key)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT })
}))

// Mock components
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  __esModule: true,
  default: ({ title, content, disableHover, ...domProps }) => (
    <div data-testid="bc-widget-card" {...domProps}>
      <div data-testid="widget-title">{title}</div>
      <div data-testid="widget-content">{content}</div>
    </div>
  )
}))

vi.mock('@/components/Loading', () => ({
  __esModule: true,
  default: ({ message }) => <div data-testid="loading">{message}</div>
}))

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: ({ children, onClick, ...props }) => (
    <span data-testid="bc-typography" onClick={onClick} {...props}>
      {children}
    </span>
  )
}))

describe('ComplianceReportCard Component', () => {
  const mockNavigate = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    mockT.mockClear()
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

    const loadingElement = screen.getByText('dashboard:complianceReports.loadingMessage')
    expect(loadingElement).toBeInTheDocument()
  })

  it('renders with counts data', () => {
    useComplianceReportCounts.mockReturnValue({
      data: { pendingReviews: 5 },
      isLoading: false
    })

    render(<ComplianceReportCard />, { wrapper })

    expect(screen.getByText('dashboard:complianceReports.title')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('dashboard:complianceReports.thereAre')).toBeInTheDocument()
    expect(screen.getByText('dashboard:complianceReports.crInProgress')).toBeInTheDocument()
  })

  it('navigates to reports page on link click with correct filter', () => {
    useComplianceReportCounts.mockReturnValue({
      data: { pendingReviews: 5 },
      isLoading: false
    })

    render(<ComplianceReportCard />, { wrapper })

    // Find and click the link
    const link = screen.getByText('dashboard:complianceReports.crInProgress')
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

  it('handles null/undefined counts correctly', () => {
    useComplianceReportCounts.mockReturnValue({
      data: { pendingReviews: null },
      isLoading: false
    })

    render(<ComplianceReportCard />, { wrapper })

    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('navigates to calculator when calculator link is clicked', () => {
    useComplianceReportCounts.mockReturnValue({
      data: { pendingReviews: 3 },
      isLoading: false
    })

    render(<ComplianceReportCard />, { wrapper })

    // Find calculator link by its text
    const calculatorLink = screen.getByText('report:calcTitle')
    fireEvent.click(calculatorLink)

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.REPORTS.CALCULATOR)
  })

  it('renders CountDisplay component correctly', () => {
    useComplianceReportCounts.mockReturnValue({
      data: { pendingReviews: 42 },
      isLoading: false
    })

    render(<ComplianceReportCard />, { wrapper })

    const countElement = screen.getByText('42')
    expect(countElement).toBeInTheDocument()
  })

  it('calls translation hook with correct keys', () => {
    useComplianceReportCounts.mockReturnValue({
      data: { pendingReviews: 1 },
      isLoading: false
    })

    render(<ComplianceReportCard />, { wrapper })

    expect(mockT).toHaveBeenCalledWith('dashboard:complianceReports.title')
    expect(mockT).toHaveBeenCalledWith('dashboard:complianceReports.thereAre')
    expect(mockT).toHaveBeenCalledWith('dashboard:complianceReports.crInProgress')
    expect(mockT).toHaveBeenCalledWith('report:calcTitle')
  })

  it('calls translation hook for loading message when loading', () => {
    useComplianceReportCounts.mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<ComplianceReportCard />, { wrapper })

    expect(mockT).toHaveBeenCalledWith('dashboard:complianceReports.loadingMessage')
  })

  it('calls useComplianceReportCounts hook', () => {
    useComplianceReportCounts.mockReturnValue({
      data: { pendingReviews: 1 },
      isLoading: false
    })

    render(<ComplianceReportCard />, { wrapper })

    expect(useComplianceReportCounts).toHaveBeenCalled()
  })

  it('renders renderLinkWithCount function with count display', () => {
    useComplianceReportCounts.mockReturnValue({
      data: { pendingReviews: 15 },
      isLoading: false
    })

    render(<ComplianceReportCard />, { wrapper })

    // Test that both count and link text are rendered
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('dashboard:complianceReports.crInProgress')).toBeInTheDocument()
  })

  it('handles click on compliance reports link text', () => {
    useComplianceReportCounts.mockReturnValue({
      data: { pendingReviews: 8 },
      isLoading: false
    })

    render(<ComplianceReportCard />, { wrapper })

    // Click the link text itself (not the list item)
    const linkText = screen.getByText('dashboard:complianceReports.crInProgress')
    fireEvent.click(linkText)

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
})
