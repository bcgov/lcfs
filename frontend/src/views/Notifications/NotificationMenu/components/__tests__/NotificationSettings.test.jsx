import { render, screen } from '@testing-library/react'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import { roles } from '@/constants/roles'
import { NotificationSettings } from '../NotificationSettings'

/*
 * We dynamically control the roles returned by the useCurrentUser hook so
 * every test can exercise a different branch of <NotificationSettings />.
 */
let currentUserRoles = []
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => {
    if (currentUserRoles === null) {
      return { data: null }
    }

    return {
      data: {
        roles: currentUserRoles.map((name) => ({ name }))
      }
    }
  }
}))

// Stub all child setting components with simple placeholders so we can check
// whether they were rendered without pulling in their internal complexity.
vi.mock('../BCeIDNotificationSettings', () => ({
  default: () => <div data-test="bceid-settings" />
}))
vi.mock('../IDIRAnalystNotificationSettings', () => ({
  default: () => <div data-test="analyst-settings" />
}))
vi.mock('../IDIRComplianceManagerNotificationSettings', () => ({
  default: () => <div data-test="compliance-manager-settings" />
}))
vi.mock('../IDIRDirectorNotificationSettings', () => ({
  default: () => <div data-test="director-settings" />
}))

describe('NotificationSettings component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset roles between tests
    currentUserRoles = []
  })

  it('renders BCeIDNotificationSettings for Supplier users', () => {
    currentUserRoles = [roles.supplier]
    render(<NotificationSettings />)

    expect(screen.getByTestId('bceid-settings')).toBeInTheDocument()
    expect(screen.queryByTestId('director-settings')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('compliance-manager-settings')
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('analyst-settings')).not.toBeInTheDocument()
  })

  it('renders IDIRDirectorNotificationSettings for Director users', () => {
    currentUserRoles = [roles.director]
    render(<NotificationSettings />)

    expect(screen.getByTestId('director-settings')).toBeInTheDocument()
    expect(screen.queryByTestId('bceid-settings')).not.toBeInTheDocument()
  })

  it('renders IDIRComplianceManagerNotificationSettings for Compliance Manager users', () => {
    currentUserRoles = [roles.compliance_manager]
    render(<NotificationSettings />)

    expect(
      screen.getByTestId('compliance-manager-settings')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('bceid-settings')).not.toBeInTheDocument()
  })

  it('renders IDIRAnalystNotificationSettings for Analyst users', () => {
    currentUserRoles = [roles.analyst]
    render(<NotificationSettings />)

    expect(screen.getByTestId('analyst-settings')).toBeInTheDocument()
    expect(screen.queryByTestId('bceid-settings')).not.toBeInTheDocument()
  })

  it('renders multiple sub-components when user has multiple roles', () => {
    currentUserRoles = [roles.director, roles.analyst]
    render(<NotificationSettings />)

    expect(screen.getByTestId('director-settings')).toBeInTheDocument()
    expect(screen.getByTestId('analyst-settings')).toBeInTheDocument()
  })

  it('shows loading placeholders when user data has not loaded yet', () => {
    currentUserRoles = null // special flag => useCurrentUser returns { data: null }
    const { container } = render(<NotificationSettings />)

    // There are four <Role> wrappers in the component, each should render the
    // loading placeholder when currentUser is null.
    const loadingNodes = container.querySelectorAll('[data-test="loading"]')
    expect(loadingNodes.length).toBe(4)
  })
})
