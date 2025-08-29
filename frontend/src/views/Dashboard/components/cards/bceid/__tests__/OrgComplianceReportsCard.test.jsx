import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import OrgComplianceReportsCard from '../OrgComplianceReportsCard'
import { useOrgComplianceReportCounts } from '@/hooks/useDashboard'
import { useOrganization } from '@/hooks/useOrganization'
import { wrapper } from '@/tests/utils/wrapper'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { FILTER_KEYS } from '@/constants/common'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// Mock dependencies
vi.mock('@/hooks/useDashboard')
vi.mock('@/hooks/useOrganization')
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
  default: ({ title, content, ...props }) => (
    <div data-test="bc-widget-card" {...props}>
      <div data-test="widget-title">{title}</div>
      <div data-test="widget-content">{content}</div>
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: ({ children, ...props }) => (
    <div data-test="bc-typography" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/Loading', () => ({
  __esModule: true,
  default: ({ message }) => <div data-test="loading">{message}</div>
}))

vi.mock('@mui/material', () => ({
  Stack: ({ children, ...props }) => <div data-test="stack" {...props}>{children}</div>,
  List: ({ children, ...props }) => <div data-test="list" {...props}>{children}</div>,
  ListItemButton: ({ children, onClick, ...props }) => (
    <button data-test="list-item-button" onClick={onClick} {...props}>
      {children}
    </button>
  )
}))

describe('OrgComplianceReportsCard Component', () => {
  const mockNavigate = vi.fn()
  const mockSessionStorage = {
    setItem: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  }

  beforeEach(() => {
    vi.resetAllMocks()
    useNavigate.mockReturnValue(mockNavigate)

    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true
    })

    // Default organization mock
    useOrganization.mockReturnValue({
      data: { name: 'Test Organization' },
      isLoading: false
    })
  })

  describe('CountDisplay Component', () => {
    it('renders count display with provided count', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 5, awaitingGovReview: 3 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      const countElements = screen.getAllByText('5')
      expect(countElements.length).toBeGreaterThan(0)
      const countElements2 = screen.getAllByText('3')
      expect(countElements2.length).toBeGreaterThan(0)
    })

    it('renders count display with zero count', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 1 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('renders loading state when isLoading is true', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.getByText(/Loading compliance reports card/)).toBeInTheDocument()
    })

    it('renders title even when loading', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText('Compliance reports')).toBeInTheDocument()
    })
  })

  describe('No Action Required State', () => {
    it('displays no action required message when both counts are 0', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText(/There are no reports that require any action./)).toBeInTheDocument()
      expect(screen.queryByText(/Compliance report\(s\) in progress/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Compliance report\(s\) awaiting government review/)).not.toBeInTheDocument()
    })

    it('displays no action required when inProgress is 0 and awaitingGovReview is 0', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText(/There are no reports that require any action./)).toBeInTheDocument()
    })
  })

  describe('Reports List State', () => {
    it('renders organization name when data is available', () => {
      useOrganization.mockReturnValue({
        data: { name: 'My Test Org' },
        isLoading: false
      })
      
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 2, awaitingGovReview: 1 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText(/My Test Org has:/)).toBeInTheDocument()
    })

    it('handles undefined organization name gracefully', () => {
      useOrganization.mockReturnValue({
        data: {},
        isLoading: false
      })
      
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 1, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText(/has:/)).toBeInTheDocument()
    })

    it('displays reports when inProgress > 0', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 3, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText(/Compliance report\(s\) in progress/)).toBeInTheDocument()
    })

    it('displays reports when awaitingGovReview > 0', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 2 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText(/Compliance report\(s\) awaiting government review/)).toBeInTheDocument()
    })
  })

  describe('Count Handling Edge Cases', () => {
    it('handles undefined counts data gracefully', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: undefined,
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText(/There are no reports that require any action./)).toBeInTheDocument()
    })

    it('handles null counts data gracefully', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText(/There are no reports that require any action./)).toBeInTheDocument()
    })

    it('handles missing inProgress property', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { awaitingGovReview: 1 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText(/Compliance report\(s\) awaiting government review/)).toBeInTheDocument()
    })

    it('handles missing awaitingGovReview property', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 2 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText(/Compliance report\(s\) in progress/)).toBeInTheDocument()
    })
  })

  describe('Navigation Functionality', () => {
    it('navigates to reports with DRAFT filter when in-progress link clicked', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 2, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      const inProgressLink = screen.getByText(/Compliance report\(s\) in progress/)
      fireEvent.click(inProgressLink)

      const expectedFilter = JSON.stringify({
        status: { filterType: 'text', type: 'equals', filter: COMPLIANCE_REPORT_STATUSES.DRAFT }
      })

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        FILTER_KEYS.COMPLIANCE_REPORT_GRID,
        expectedFilter
      )
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.REPORTS.LIST)
    })

    it('navigates to reports with SUBMITTED filter when awaiting-review link clicked', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 1 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      const awaitingReviewLink = screen.getByText(/Compliance report\(s\) awaiting government review/)
      fireEvent.click(awaitingReviewLink)

      const expectedFilter = JSON.stringify({
        status: { filterType: 'text', type: 'equals', filter: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
      })

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        FILTER_KEYS.COMPLIANCE_REPORT_GRID,
        expectedFilter
      )
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.REPORTS.LIST)
    })

    it('navigates to calculator when calculator button clicked', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 1, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      const calculatorButton = screen.getByText(/Credit calculator/)
      fireEvent.click(calculatorButton)

      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.REPORTS.CALCULATOR)
    })

    it('shows calculator button even when no reports require action', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      const calculatorButton = screen.getByText(/Credit calculator/)
      expect(calculatorButton).toBeInTheDocument()

      fireEvent.click(calculatorButton)
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.REPORTS.CALCULATOR)
    })
  })

  describe('renderLinkWithCount Function Coverage', () => {
    it('does not render link when count is 0', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 5 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.queryByText(/Compliance report\(s\) in progress/)).not.toBeInTheDocument()
      expect(screen.getByText(/Compliance report\(s\) awaiting government review/)).toBeInTheDocument()
    })

    it('renders link when count > 0', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 3, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText(/Compliance report\(s\) in progress/)).toBeInTheDocument()
      expect(screen.queryByText(/Compliance report\(s\) awaiting government review/)).not.toBeInTheDocument()
    })
  })

  describe('Widget Card Props', () => {
    it('renders widget card with correct title', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByTestId('widget-title')).toHaveTextContent('Compliance reports')
    })

    it('passes content to widget card', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByTestId('widget-content')).toBeInTheDocument()
    })
  })

  describe('Hook Coverage', () => {
    it('calls useTranslation hook', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText('Compliance reports')).toBeInTheDocument()
    })

    it('calls useNavigate hook', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 1, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(useNavigate).toHaveBeenCalled()
    })

    it('calls useOrganization hook', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(useOrganization).toHaveBeenCalled()
    })

    it('calls useOrgComplianceReportCounts hook', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(useOrgComplianceReportCounts).toHaveBeenCalled()
    })
  })

  describe('Complex Scenarios', () => {
    it('handles both counts present and positive', () => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 3, awaitingGovReview: 2 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText(/Compliance report\(s\) in progress/)).toBeInTheDocument()
      expect(screen.getByText(/Compliance report\(s\) awaiting government review/)).toBeInTheDocument()
    })

    it('handles organization loading state', () => {
      useOrganization.mockReturnValue({
        data: null,
        isLoading: true
      })
      
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 1, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, { wrapper })

      expect(screen.getByText(/has:/)).toBeInTheDocument()
    })
  })
})