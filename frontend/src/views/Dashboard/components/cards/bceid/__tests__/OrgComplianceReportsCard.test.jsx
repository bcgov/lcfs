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
import withRole from '@/utils/withRole'

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

describe('OrgComplianceReportsCard Component', () => {
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

    // Default organization mock
    useOrganization.mockReturnValue({
      data: { name: 'Test Organization' },
      isLoading: false
    })
  })

  it('renders loading state correctly', () => {
    useOrgComplianceReportCounts.mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<OrgComplianceReportsCard />, { wrapper })

    const loadingElement = screen.getByText(/Loading compliance reports card/)
    expect(loadingElement).toBeInTheDocument()
  })

  it('renders with counts data', () => {
    useOrgComplianceReportCounts.mockReturnValue({
      data: {
        inProgress: 2,
        awaitingGovReview: 1
      },
      isLoading: false
    })

    render(<OrgComplianceReportsCard />, { wrapper })

    // Check for title and intro text
    expect(screen.getByText('Compliance reports')).toBeInTheDocument()
    expect(screen.getByText(/Test Organization has:/)).toBeInTheDocument()

    // Check that all categories are displayed with correct counts
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()

    expect(
      screen.getByText(/Compliance report\(s\) in progress/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Compliance report\(s\) awaiting government review/)
    ).toBeInTheDocument()
  })

  it('navigates to reports page with DRAFT filter when in-progress link is clicked', () => {
    useOrgComplianceReportCounts.mockReturnValue({
      data: { inProgress: 2 },
      isLoading: false
    })

    render(<OrgComplianceReportsCard />, { wrapper })

    // Find and click the in-progress link
    const link = screen.getByText(/Compliance report\(s\) in progress/, {
      exact: false
    })
    fireEvent.click(link)

    // Check that sessionStorage was updated with the correct filter
    const expectedFilter = JSON.stringify({
      status: {
        filterType: 'text',
        type: 'equals',
        filter: COMPLIANCE_REPORT_STATUSES.DRAFT
      }
    })

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      FILTER_KEYS.COMPLIANCE_REPORT_GRID,
      expectedFilter
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.REPORTS.LIST)
  })

  it('navigates to reports page with SUBMITTED filter when awaiting-review link is clicked', () => {
    useOrgComplianceReportCounts.mockReturnValue({
      data: { awaitingGovReview: 1 },
      isLoading: false
    })

    render(<OrgComplianceReportsCard />, { wrapper })

    // Find and click the awaiting-review link
    const link = screen.getByText(
      /Compliance report\(s\) awaiting government review/,
      { exact: false }
    )
    fireEvent.click(link)

    // Check that sessionStorage was updated with the correct filter
    const expectedFilter = JSON.stringify({
      status: {
        filterType: 'text',
        type: 'equals',
        filter: COMPLIANCE_REPORT_STATUSES.SUBMITTED
      }
    })

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      FILTER_KEYS.COMPLIANCE_REPORT_GRID,
      expectedFilter
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.REPORTS.LIST)
  })

  it('displays a message when there are no reports requiring action', () => {
    useOrgComplianceReportCounts.mockReturnValue({
      data: {
        inProgress: 0,
        awaitingGovReview: 0
      },
      isLoading: false
    })

    render(<OrgComplianceReportsCard />, { wrapper })

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
})
