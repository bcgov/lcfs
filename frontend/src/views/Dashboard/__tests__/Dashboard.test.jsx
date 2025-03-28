import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Dashboard } from '../Dashboard'
import { wrapper } from '@/tests/utils/wrapper'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'

// Mock components
vi.mock('@/components/Role', () => ({
  Role: ({ roles, children }) => (
    <div data-test={`role-${Array.isArray(roles) ? roles.join('-') : roles}`}>
      {children}
    </div>
  )
}))

// Mock nested components
vi.mock('../components/cards', () => ({
  AdminLinksCard: () => (
    <div data-test="admin-links-card">Admin Links Card</div>
  ),
  DirectorReviewCard: () => (
    <div data-test="director-review-card">Director Review Card</div>
  ),
  TransactionsCard: () => (
    <div data-test="transactions-card">Transactions Card</div>
  ),
  UserSettingsCard: () => (
    <div data-test="user-settings-card">User Settings Card</div>
  ),
  OrgDetailsCard: () => (
    <div data-test="org-details-card">Org Details Card</div>
  ),
  OrgBalanceCard: () => (
    <div data-test="org-balance-card">Org Balance Card</div>
  ),
  FeedbackCard: () => <div data-test="feedback-card">Feedback Card</div>,
  WebsiteCard: () => <div data-test="website-card">Website Card</div>,
  OrgTransactionsCard: () => (
    <div data-test="org-transactions-card">Org Transactions Card</div>
  ),
  OrgComplianceReportsCard: () => (
    <div data-test="org-compliance-reports-card">
      Org Compliance Reports Card
    </div>
  ),
  OrgUserSettingsCard: () => (
    <div data-test="org-user-settings-card">Org User Settings Card</div>
  )
}))

vi.mock('../components/cards/idir/OrganizationsSummaryCard', () => ({
  __esModule: true,
  default: () => (
    <div data-test="organizations-summary-card">Organizations Summary Card</div>
  )
}))

vi.mock('../components/cards/idir/FuelCodeCard', () => ({
  FuelCodeCard: () => <div data-test="fuel-code-card">Fuel Code Card</div>
}))

vi.mock('../components/cards/idir/ComplianceReportCard', () => ({
  ComplianceReportCard: () => (
    <div data-test="compliance-report-card">Compliance Report Card</div>
  )
}))

// Mock the user hook
vi.mock('@/hooks/useCurrentUser')

describe('Dashboard Component', () => {
  beforeEach(() => {
    // Default to a government user with analyst role
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Government' }, { name: 'Analyst' }]
      }
    })
  })

  it('renders the dashboard container', () => {
    render(<Dashboard />, { wrapper })
    expect(screen.getByTestId('dashboard-container')).toBeInTheDocument()
  })

  it('renders the appropriate cards for government analyst role', () => {
    render(<Dashboard />, { wrapper })

    // Gov role related components
    expect(
      screen.getAllByTestId(
        'role-Government-Administrator-Analyst-Compliance Manager-Director'
      )
    ).not.toHaveLength(0)
    expect(screen.getByText('Organizations Summary Card')).toBeInTheDocument()
    expect(screen.getByText('Transactions Card')).toBeInTheDocument()
    expect(screen.getByText('Compliance Report Card')).toBeInTheDocument()
    expect(screen.getByText('Fuel Code Card')).toBeInTheDocument()
    expect(screen.getByText('User Settings Card')).toBeInTheDocument()
  })

  it('renders the appropriate cards for non-government user with transfers role', () => {
    // Mock a non-government user with transfers role
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Transfer' }]
      }
    })

    render(<Dashboard />, { wrapper })

    // Non-gov role related components
    expect(screen.getByTestId('role-Transfer')).toBeInTheDocument()
    expect(
      screen.getAllByTestId(
        'role-Supplier-Manage Users-Transfer-Compliance Reporting-Signing Authority-Read Only'
      )
    ).not.toHaveLength(0)
    expect(screen.getByText('Org Balance Card')).toBeInTheDocument()
    expect(screen.getByText('Feedback Card')).toBeInTheDocument()
    expect(screen.getByText('Website Card')).toBeInTheDocument()
    expect(screen.getByText('Org Details Card')).toBeInTheDocument()
    expect(screen.getByText('Org Transactions Card')).toBeInTheDocument()
    expect(screen.getByText('Org User Settings Card')).toBeInTheDocument()
  })

  it('renders the appropriate cards for director role', () => {
    // Reset the mock with only Director role
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Government' }, { name: 'Director' }]
      }
    })

    render(<Dashboard />, { wrapper })

    // Director specific components
    expect(screen.getByTestId(`role-${roles.director}`)).toBeInTheDocument()
    expect(screen.getByText('Director Review Card')).toBeInTheDocument()
  })

  it('renders the appropriate cards for compliance reporting role', () => {
    // Mock a compliance reporting user
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Compliance Reporting' }]
      }
    })

    render(<Dashboard />, { wrapper })

    // Compliance reporting specific components
    expect(
      screen.getByTestId('role-Compliance Reporting-Signing Authority')
    ).toBeInTheDocument()
    expect(screen.getByText('Org Compliance Reports Card')).toBeInTheDocument()
  })
})
