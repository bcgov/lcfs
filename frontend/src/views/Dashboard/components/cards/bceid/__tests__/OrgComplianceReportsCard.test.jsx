import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import OrgComplianceReportsCard from '../OrgComplianceReportsCard'
import { useOrgComplianceReportCounts } from '@/hooks/useDashboard'
import { useOrganization } from '@/hooks/useOrganization'
import { test } from '@/tests/utils/fixtures'
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

vi.mock('@mui/material/Stack', () => ({
  default: ({ children, ...props }) => (
    <div data-test="stack" {...props}>
      {children}
    </div>
  )
}))
vi.mock('@mui/material/List', () => ({
  default: ({ children, ...props }) => (
    <div data-test="list" {...props}>
      {children}
    </div>
  )
}))
vi.mock('@mui/material/ListItemButton', () => ({
  default: ({ children, onClick, ...props }) => (
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
    test('renders count display with provided count', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 5, awaitingGovReview: 3 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      const countElements = screen.getAllByText('5')
      expect(countElements.length).toBeGreaterThan(0)
      const countElements2 = screen.getAllByText('3')
      expect(countElements2.length).toBeGreaterThan(0)
    })

    test('renders count display with zero count', ({ render, query, i18n }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 1 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    test('renders loading state when isLoading is true', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(
        screen.getByText(/Loading compliance reports card/)
      ).toBeInTheDocument()
    })

    test('renders title even when loading', ({ render, query, i18n }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByText('Compliance reports')).toBeInTheDocument()
    })
  })

  describe('No Action Required State', () => {
    test('displays no action required message when both counts are 0', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(
        screen.getByText(/There are no reports that require any action./)
      ).toBeInTheDocument()
      expect(
        screen.queryByText(/Compliance report\(s\) in progress/)
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText(/Compliance report\(s\) awaiting government review/)
      ).not.toBeInTheDocument()
    })

    test('displays no action required when inProgress is 0 and awaitingGovReview is 0', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(
        screen.getByText(/There are no reports that require any action./)
      ).toBeInTheDocument()
    })
  })

  describe('Reports List State', () => {
    test('renders organization name when data is available', ({
      render,
      query,
      i18n
    }) => {
      useOrganization.mockReturnValue({
        data: { name: 'My Test Org' },
        isLoading: false
      })

      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 2, awaitingGovReview: 1 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByText(/My Test Org has:/)).toBeInTheDocument()
    })

    test('handles undefined organization name gracefully', ({
      render,
      query,
      i18n
    }) => {
      useOrganization.mockReturnValue({
        data: {},
        isLoading: false
      })

      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 1, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByText(/has:/)).toBeInTheDocument()
    })

    test('displays reports when inProgress > 0', ({ render, query, i18n }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 3, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByText('3')).toBeInTheDocument()
      expect(
        screen.getByText(/Compliance report\(s\) in progress/)
      ).toBeInTheDocument()
    })

    test('displays reports when awaitingGovReview > 0', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 2 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByText('2')).toBeInTheDocument()
      expect(
        screen.getByText(/Compliance report\(s\) awaiting government review/)
      ).toBeInTheDocument()
    })
  })

  describe('Count Handling Edge Cases', () => {
    test('handles undefined counts data gracefully', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: undefined,
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(
        screen.getByText(/There are no reports that require any action./)
      ).toBeInTheDocument()
    })

    test('handles null counts data gracefully', ({ render, query, i18n }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(
        screen.getByText(/There are no reports that require any action./)
      ).toBeInTheDocument()
    })

    test('handles missing inProgress property', ({ render, query, i18n }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { awaitingGovReview: 1 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(
        screen.getByText(/Compliance report\(s\) awaiting government review/)
      ).toBeInTheDocument()
    })

    test('handles missing awaitingGovReview property', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 2 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByText('2')).toBeInTheDocument()
      expect(
        screen.getByText(/Compliance report\(s\) in progress/)
      ).toBeInTheDocument()
    })
  })

  describe('Navigation Functionality', () => {
    test('navigates to reports with DRAFT filter when in-progress link clicked', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 2, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      const inProgressLink = screen.getByText(
        /Compliance report\(s\) in progress/
      )
      fireEvent.click(inProgressLink)

      const expectedFilter = JSON.stringify({
        status: {
          filterType: 'text',
          type: 'equals',
          filter: COMPLIANCE_REPORT_STATUSES.DRAFT
        }
      })

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        FILTER_KEYS.COMPLIANCE_REPORT_GRID,
        expectedFilter
      )
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.REPORTS.LIST)
    })

    test('navigates to reports with SUBMITTED filter when awaiting-review link clicked', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 1 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      const awaitingReviewLink = screen.getByText(
        /Compliance report\(s\) awaiting government review/
      )
      fireEvent.click(awaitingReviewLink)

      const expectedFilter = JSON.stringify({
        status: {
          filterType: 'text',
          type: 'equals',
          filter: COMPLIANCE_REPORT_STATUSES.SUBMITTED
        }
      })

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        FILTER_KEYS.COMPLIANCE_REPORT_GRID,
        expectedFilter
      )
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.REPORTS.LIST)
    })

    test('navigates to calculator when calculator button clicked', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 1, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      const calculatorButton = screen.getByText(/Compliance unit calculator/)
      fireEvent.click(calculatorButton)

      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CREDIT_CALCULATOR)
    })

    test('shows calculator button even when no reports require action', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      const calculatorButton = screen.getByText(/Compliance unit calculator/)
      expect(calculatorButton).toBeInTheDocument()

      fireEvent.click(calculatorButton)
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CREDIT_CALCULATOR)
    })
  })

  describe('renderLinkWithCount Function Coverage', () => {
    test('does not render link when count is 0', ({ render, query, i18n }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 5 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(
        screen.queryByText(/Compliance report\(s\) in progress/)
      ).not.toBeInTheDocument()
      expect(
        screen.getByText(/Compliance report\(s\) awaiting government review/)
      ).toBeInTheDocument()
    })

    test('renders link when count > 0', ({ render, query, i18n }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 3, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(
        screen.getByText(/Compliance report\(s\) in progress/)
      ).toBeInTheDocument()
      expect(
        screen.queryByText(/Compliance report\(s\) awaiting government review/)
      ).not.toBeInTheDocument()
    })
  })

  describe('Widget Card Props', () => {
    test('renders widget card with correct title', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByTestId('widget-title')).toHaveTextContent(
        'Compliance reports'
      )
    })

    test('passes content to widget card', ({ render, query, i18n }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByTestId('widget-content')).toBeInTheDocument()
    })
  })

  describe('Hook Coverage', () => {
    test('calls useTranslation hook', ({ render, query, i18n }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByText('Compliance reports')).toBeInTheDocument()
    })

    test('calls useNavigate hook', ({ render, query, i18n }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 1, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(useNavigate).toHaveBeenCalled()
    })

    test('calls useOrganization hook', ({ render, query, i18n }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(useOrganization).toHaveBeenCalled()
    })

    test('calls useOrgComplianceReportCounts hook', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 0, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(useOrgComplianceReportCounts).toHaveBeenCalled()
    })
  })

  describe('Complex Scenarios', () => {
    test('handles both counts present and positive', ({
      render,
      query,
      i18n
    }) => {
      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 3, awaitingGovReview: 2 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(
        screen.getByText(/Compliance report\(s\) in progress/)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Compliance report\(s\) awaiting government review/)
      ).toBeInTheDocument()
    })

    test('handles organization loading state', ({ render, query, i18n }) => {
      useOrganization.mockReturnValue({
        data: null,
        isLoading: true
      })

      useOrgComplianceReportCounts.mockReturnValue({
        data: { inProgress: 1, awaitingGovReview: 0 },
        isLoading: false
      })

      render(<OrgComplianceReportsCard />, [query, i18n])

      expect(screen.getByText(/has:/)).toBeInTheDocument()
    })
  })
})
