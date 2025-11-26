import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Dashboard } from '../Dashboard'
import { Dashboard as DashboardFromIndex } from '../index'
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
  GovernmentNotificationsCard: () => (
    <div data-test="government-notifications-card">Government Notifications Card</div>
  ),
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
    vi.clearAllMocks()
    // Default to a government user with analyst role
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Government' }, { name: 'Analyst' }]
      }
    })
  })

  it('exports Dashboard component from index', () => {
    expect(Dashboard).toBe(DashboardFromIndex)
  })

  it('renders the dashboard container with correct structure', () => {
    render(<Dashboard />, { wrapper })
    const container = screen.getByTestId('dashboard-container')
    expect(container).toBeInTheDocument()
    expect(container).toHaveClass('MuiGrid-container')
  })

  it('renders main Box with margin-top prop', () => {
    render(<Dashboard />, { wrapper })
    const container = screen.getByTestId('dashboard-container')
    expect(container.parentElement).toHaveClass('MuiBox-root')
  })

  it('renders three main grid sections with correct responsive props', () => {
    const { container } = render(<Dashboard />, { wrapper })
    const gridItems = container.querySelectorAll('.MuiGrid-item')
    expect(gridItems).toHaveLength(3)
    
    // Left section
    expect(gridItems[0]).toHaveClass('MuiGrid-grid-xs-12')
    expect(gridItems[0]).toHaveClass('MuiGrid-grid-sm-6')
    expect(gridItems[0]).toHaveClass('MuiGrid-grid-md-5')
    expect(gridItems[0]).toHaveClass('MuiGrid-grid-lg-3')
    
    // Central section
    expect(gridItems[1]).toHaveClass('MuiGrid-grid-xs-12')
    expect(gridItems[1]).toHaveClass('MuiGrid-grid-lg-6')
    
    // Right section
    expect(gridItems[2]).toHaveClass('MuiGrid-grid-xs-12')
    expect(gridItems[2]).toHaveClass('MuiGrid-grid-sm-6')
    expect(gridItems[2]).toHaveClass('MuiGrid-grid-md-5')
    expect(gridItems[2]).toHaveClass('MuiGrid-grid-lg-3')
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

  it('renders Left Section Role components with correct structure', () => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Supplier' }]
      }
    })

    render(<Dashboard />, { wrapper })

    // Test nonGovRoles components - using getAllByTestId since there are multiple instances
    expect(
      screen.getAllByTestId(
        'role-Supplier-Manage Users-Transfer-Compliance Reporting-Signing Authority-Read Only'
      )
    ).toHaveLength(3)
    expect(screen.getByText('Org Balance Card')).toBeInTheDocument()
    expect(screen.getByText('Feedback Card')).toBeInTheDocument()
    expect(screen.getByText('Website Card')).toBeInTheDocument()
  })

  it('renders Central Section Role components for specific roles', () => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Transfer' }]
      }
    })

    render(<Dashboard />, { wrapper })

    // Test transfers role in central section
    expect(screen.getByTestId('role-Transfer')).toBeInTheDocument()
    expect(screen.getByText('Org Transactions Card')).toBeInTheDocument()
  })

  it('renders Right Section admin and user settings components', () => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Government' }, { name: 'Administrator' }]
      }
    })

    render(<Dashboard />, { wrapper })

    // Test admin role in right section - using more flexible approach
    expect(screen.getByText('Admin Links Card')).toBeInTheDocument()
    expect(screen.getByText('User Settings Card')).toBeInTheDocument()
    
    // Verify role components are present
    const govRoles = screen.getAllByTestId(
      'role-Government-Administrator-Analyst-Compliance Manager-Director'
    )
    expect(govRoles.length).toBeGreaterThan(0)
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

  it('renders nested Role components in Central Section for government users', () => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Government' }, { name: 'Analyst' }, { name: 'Compliance Manager' }]
      }
    })

    render(<Dashboard />, { wrapper })

    // Test nested roles structure - using getAllByTestId for multiple instances
    const govRoles = screen.getAllByTestId(
      'role-Government-Administrator-Analyst-Compliance Manager-Director'
    )
    expect(govRoles.length).toBeGreaterThan(0)
    
    expect(screen.getByTestId('role-Analyst-Compliance Manager')).toBeInTheDocument()
    expect(screen.getByTestId('role-Analyst')).toBeInTheDocument()
  })

  it('renders all card components when multiple roles are present', () => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: [
          { name: 'Government' },
          { name: 'Analyst' },
          { name: 'Director' },
          { name: 'Administrator' }
        ]
      }
    })

    render(<Dashboard />, { wrapper })

    // Gov analyst cards
    expect(screen.getByText('Organizations Summary Card')).toBeInTheDocument()
    expect(screen.getByText('Transactions Card')).toBeInTheDocument()
    expect(screen.getByText('Compliance Report Card')).toBeInTheDocument()
    expect(screen.getByText('Fuel Code Card')).toBeInTheDocument()
    
    // Director card
    expect(screen.getByText('Director Review Card')).toBeInTheDocument()
    
    // Admin and settings cards
    expect(screen.getByText('Admin Links Card')).toBeInTheDocument()
    expect(screen.getByText('User Settings Card')).toBeInTheDocument()
  })
})
