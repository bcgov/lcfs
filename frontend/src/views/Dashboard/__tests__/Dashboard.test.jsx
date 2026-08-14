import React from 'react'
import { screen } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { Dashboard } from '../Dashboard'
import { Dashboard as DashboardFromIndex } from '../index'
import { test } from '@/tests/utils/fixtures'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles, govRoles, nonGovRoles } from '@/constants/roles'

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
    <div data-test="government-notifications-card">
      Government Notifications Card
    </div>
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
  OrgFuelCodeCard: () => (
    <div data-test="org-fuel-code-card">Org Fuel Code Card</div>
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

vi.mock('../components/cards/idir/CIApplicationCard', () => ({
  CIApplicationCard: () => (
    <div data-test="ci-application-card">CI Application Card</div>
  )
}))

vi.mock('../components/cards/idir/ComplianceReportCard', () => ({
  ComplianceReportCard: () => (
    <div data-test="compliance-report-card">Compliance Report Card</div>
  )
}))

// Mock the user hook
vi.mock('@/hooks/useCurrentUser')

describe('Dashboard Component', () => {
  const govRolesTestId = `role-${govRoles.join('-')}`
  const nonGovRolesTestId = `role-${nonGovRoles.join('-')}`

  beforeEach(() => {
    vi.clearAllMocks()
    // Default to a government user with analyst role
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Government' }, { name: 'Analyst' }]
      }
    })
  })

  test('exports Dashboard component from index', () => {
    expect(Dashboard).toBe(DashboardFromIndex)
  })

  test('renders the dashboard container with correct structure', ({
    render,
    query,
    theme
  }) => {
    render(<Dashboard />, [query, theme])
    const container = screen.getByTestId('dashboard-container')
    expect(container).toBeInTheDocument()
    expect(container).toHaveClass('MuiGrid-container')
  })

  test('renders main Box with margin-top prop', ({ render, query, theme }) => {
    render(<Dashboard />, [query, theme])
    const container = screen.getByTestId('dashboard-container')
    expect(container.parentElement).toHaveClass('MuiBox-root')
  })

  test('renders three main grid sections with correct responsive props', ({
    render,
    query,
    theme
  }) => {
    const { container } = render(<Dashboard />, [query, theme])
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

  test('renders the appropriate cards for government analyst role', ({
    render,
    query,
    theme
  }) => {
    render(<Dashboard />, [query, theme])

    // Gov role related components
    expect(screen.getAllByTestId(govRolesTestId)).not.toHaveLength(0)
    expect(screen.getByText('Organizations Summary Card')).toBeInTheDocument()
    expect(screen.getByText('Transactions Card')).toBeInTheDocument()
    expect(screen.getByText('Compliance Report Card')).toBeInTheDocument()
    expect(screen.getByText('CI Application Card')).toBeInTheDocument()
    expect(screen.getByText('User Settings Card')).toBeInTheDocument()
  })

  test('renders the appropriate cards for non-government user with transfers role', ({
    render,
    query,
    theme
  }) => {
    // Mock a non-government user with transfers role
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Transfer' }]
      }
    })

    render(<Dashboard />, [query, theme])

    // Non-gov role related components
    expect(screen.getByTestId('role-Transfer')).toBeInTheDocument()
    expect(screen.getAllByTestId(nonGovRolesTestId)).not.toHaveLength(0)
    expect(screen.getByText('Org Balance Card')).toBeInTheDocument()
    expect(screen.getByText('Feedback Card')).toBeInTheDocument()
    expect(screen.getByText('Website Card')).toBeInTheDocument()
    expect(screen.getByText('Org Details Card')).toBeInTheDocument()
    expect(screen.getByText('Org Transactions Card')).toBeInTheDocument()
    expect(screen.getByText('Org User Settings Card')).toBeInTheDocument()
  })

  test('renders the appropriate cards for director role', ({
    render,
    query,
    theme
  }) => {
    // Reset the mock with only Director role
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Government' }, { name: 'Director' }]
      }
    })

    render(<Dashboard />, [query, theme])

    // Director specific components
    expect(screen.getByTestId(`role-${roles.director}`)).toBeInTheDocument()
    expect(screen.getByText('Director Review Card')).toBeInTheDocument()
  })

  test('renders Left Section Role components with correct structure', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Supplier' }]
      }
    })

    render(<Dashboard />, [query, theme])

    // Test nonGovRoles components - using getAllByTestId since there are multiple instances
    expect(screen.getAllByTestId(nonGovRolesTestId)).toHaveLength(3)
    expect(screen.getByText('Org Balance Card')).toBeInTheDocument()
    expect(screen.getByText('Feedback Card')).toBeInTheDocument()
    expect(screen.getByText('Website Card')).toBeInTheDocument()
  })

  test('renders Central Section Role components for specific roles', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Transfer' }]
      }
    })

    render(<Dashboard />, [query, theme])

    // Test transfers role in central section
    expect(screen.getByTestId('role-Transfer')).toBeInTheDocument()
    expect(screen.getByText('Org Transactions Card')).toBeInTheDocument()
  })

  test('renders Right Section admin and user settings components', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Government' }, { name: 'Administrator' }]
      }
    })

    render(<Dashboard />, [query, theme])

    // Test admin role in right section - using more flexible approach
    expect(screen.getByText('Admin Links Card')).toBeInTheDocument()
    expect(screen.getByText('User Settings Card')).toBeInTheDocument()

    expect(screen.getAllByTestId(govRolesTestId).length).toBeGreaterThan(0)
  })

  test('renders the appropriate cards for compliance reporting role', ({
    render,
    query,
    theme
  }) => {
    // Mock a compliance reporting user
    useCurrentUser.mockReturnValue({
      data: {
        roles: [{ name: 'Compliance Reporting' }]
      }
    })

    render(<Dashboard />, [query, theme])

    // Compliance reporting specific components
    expect(
      screen.getByTestId('role-Compliance Reporting-Signing Authority')
    ).toBeInTheDocument()
    expect(screen.getByText('Org Compliance Reports Card')).toBeInTheDocument()
  })

  test('renders nested Role components in Central Section for government users', ({
    render,
    query,
    theme
  }) => {
    useCurrentUser.mockReturnValue({
      data: {
        roles: [
          { name: 'Government' },
          { name: 'Analyst' },
          { name: 'Compliance Manager' }
        ]
      }
    })

    render(<Dashboard />, [query, theme])

    expect(screen.getAllByTestId(govRolesTestId).length).toBeGreaterThan(0)

    expect(
      screen.getByTestId('role-Analyst-Compliance Manager')
    ).toBeInTheDocument()
    expect(screen.getByTestId('role-Analyst')).toBeInTheDocument()
  })

  test('renders all card components when multiple roles are present', ({
    render,
    query,
    theme
  }) => {
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

    render(<Dashboard />, [query, theme])

    // Gov analyst cards
    expect(screen.getByText('Organizations Summary Card')).toBeInTheDocument()
    expect(screen.getByText('Transactions Card')).toBeInTheDocument()
    expect(screen.getByText('Compliance Report Card')).toBeInTheDocument()
    expect(screen.getByText('CI Application Card')).toBeInTheDocument()

    // Director card
    expect(screen.getByText('Director Review Card')).toBeInTheDocument()

    // Admin and settings cards
    expect(screen.getByText('Admin Links Card')).toBeInTheDocument()
    expect(screen.getByText('User Settings Card')).toBeInTheDocument()
  })
})
