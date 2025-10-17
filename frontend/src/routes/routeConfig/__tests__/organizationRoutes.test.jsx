import { describe, it, expect, vi } from 'vitest'
import { organizationRoutes } from '../organizationRoutes'
import * as OrganizationsModule from '@/views/Organizations'
import * as UsersModule from '@/views/Users'
import UserDetailsCard from '@/views/Admin/AdminMenu/components/UserDetailsCard'

/**
 * Tests for organizationRoutes configuration
 *
 * Current route structure:
 * - All user-related routes now use userType="bceid"
 * - Organization admin routes: /organizations/...
 * - BCeID self-service routes: /organization/...
 * - Both use UserDetailsCard with userType="bceid"
 */

// Mock the view components
vi.mock('@/views/Organizations', () => ({
  Organizations: vi.fn(() => 'Organizations'),
  AddEditOrg: vi.fn(() => 'AddEditOrg'),
  OrganizationView: vi.fn(() => 'OrganizationView')
}))

vi.mock('@/views/Users', () => ({
  AddEditUser: vi.fn(() => 'AddEditUser')
}))

vi.mock('@/views/Admin/AdminMenu/components/UserDetailsCard', () => {
  const MockUserDetailsCard = vi.fn(() => 'UserDetailsCard')
  MockUserDetailsCard.displayName = 'UserDetailsCard'
  return {
    __esModule: true,
    default: MockUserDetailsCard
  }
})

vi.mock('../routes', () => ({
  __esModule: true,
  default: {
    ORGANIZATIONS: {
      LIST: '/organizations',
      ADD: '/organizations/add-org',
      VIEW: '/organizations/:orgID',
      USERS: '/organizations/:orgID/users',
      CREDIT_LEDGER: '/organizations/:orgID/credit-ledger',
      COMPANY_OVERVIEW: '/organizations/:orgID/company-overview',
      PENALTY_LOG: '/organizations/:orgID/penalty-log',
      PENALTY_LOG_MANAGE: '/organizations/:orgID/penalty-log/manage',
      SUPPLY_HISTORY: '/organizations/:orgID/supply-history',
      COMPLIANCE_TRACKING: '/organizations/:orgID/compliance-tracking',
      ADD_USER: '/organizations/:orgID/add-user',
      VIEW_USER: '/organizations/:orgID/users/:userID'
    },
    ORGANIZATION: {
      ORG: '/organization',
      USERS: '/organization/users',
      ADD_USER: '/organization/add-user',
      VIEW_USER: '/organization/users/:userID',
      CREDIT_LEDGER: '/organization/credit-ledger'
    }
  }
}))

describe('organizationRoutes', () => {
  it('should export an array of route configurations', () => {
    expect(Array.isArray(organizationRoutes)).toBe(true)
    expect(organizationRoutes.length).toBe(17)
  })

  it('should have all expected route paths', () => {
    const expectedPaths = [
      '/organizations',
      '/organizations/add-org',
      '/organizations/:orgID',
      '/organizations/:orgID/users',
      '/organizations/:orgID/credit-ledger',
      '/organizations/:orgID/company-overview',
      '/organizations/:orgID/penalty-log',
      '/organizations/:orgID/penalty-log/manage',
      '/organizations/:orgID/supply-history',
      '/organizations/:orgID/compliance-tracking',
      '/organizations/:orgID/add-user',
      '/organizations/:orgID/users/:userID',
      '/organization',
      '/organization/users',
      '/organization/add-user',
      '/organization/users/:userID',
      '/organization/credit-ledger'
    ]

    const actualPaths = organizationRoutes.map((route) => route.path)
    expectedPaths.forEach((path) => {
      expect(actualPaths).toContain(path)
    })
    expect(actualPaths.length).toBe(expectedPaths.length)
  })

  describe('Route Groups', () => {
    it('should have correct IDIR organization admin routes', () => {
      const idirRoutes = organizationRoutes.filter((route) =>
        route.path.startsWith('/organizations')
      )
      expect(idirRoutes.length).toBe(12)

      const expectedIdirPaths = [
        '/organizations',
        '/organizations/add-org',
        '/organizations/:orgID',
        '/organizations/:orgID/users',
        '/organizations/:orgID/credit-ledger',
        '/organizations/:orgID/company-overview',
        '/organizations/:orgID/penalty-log',
        '/organizations/:orgID/penalty-log/manage',
        '/organizations/:orgID/supply-history',
        '/organizations/:orgID/compliance-tracking',
        '/organizations/:orgID/add-user',
        '/organizations/:orgID/users/:userID'
      ]

      idirRoutes.forEach((route) => {
        expect(expectedIdirPaths).toContain(route.path)
      })
    })

    it('should have correct BCeID self-service routes', () => {
      const bceidRoutes = organizationRoutes.filter(
      (route) =>
          route.path.startsWith('/organization') &&
          !route.path.startsWith('/organizations')
      )
      expect(bceidRoutes.length).toBe(5)

      const expectedBceidPaths = [
        '/organization',
        '/organization/users',
        '/organization/add-user',
        '/organization/users/:userID',
        '/organization/credit-ledger'
      ]

      bceidRoutes.forEach((route) => {
        expect(expectedBceidPaths).toContain(route.path)
      })
    })
  })
  const listRoute = organizationRoutes.find(
    (route) => route.path === '/organizations'
  )
  expect(listRoute).toBeDefined()
  expect(listRoute.handle.title).toBe('Organizations')
  expect(listRoute.handle.crumb()).toBe('Organizations')
})

it('should have correct route structure for add organization', () => {
  const addRoute = organizationRoutes.find(
    (route) => route.path === '/organizations/add-org'
  )
  expect(addRoute).toBeDefined()
  expect(addRoute.handle.title).toBe('Add organization')
  expect(addRoute.handle.crumb).toBeUndefined()
})

it('should have correct route structure for organization profile view', () => {
  const viewRoute = organizationRoutes.find(
    (route) => route.path === '/organizations/:orgID'
  )
  expect(viewRoute).toBeDefined()
  expect(viewRoute.handle.title).toBe('Organization profile')
  expect(viewRoute.handle.crumb).toBeUndefined()
})

it('should have correct route structure for add user to organization', () => {
  const addUserRoute = organizationRoutes.find(
    (route) => route.path === '/organizations/:orgID/add-user'
  )
  expect(addUserRoute).toBeDefined()
  expect(addUserRoute.handle.title).toBe('New user')
  expect(addUserRoute.handle.crumb).toBeUndefined()
})

it('should have correct route structure for view user in organization', () => {
  const viewUserRoute = organizationRoutes.find(
    (route) => route.path === '/organizations/:orgID/users/:userID'
  )
  expect(viewUserRoute).toBeDefined()
  expect(viewUserRoute.handle.title).toBe('User profile')
  expect(viewUserRoute.handle.crumb()).toBe('Users')
})

it('should have correct route structure for organization (BCeID)', () => {
  const orgRoute = organizationRoutes.find(
    (route) => route.path === '/organization'
  )
  expect(orgRoute).toBeDefined()
  expect(orgRoute.handle.title).toBe('Organization')
  expect(orgRoute.handle.crumb).toBeUndefined()
})

it('should have correct route structure for BCeID add user', () => {
  const addUserRoute = organizationRoutes.find(
    (route) => route.path === '/organization/add-user'
  )
  expect(addUserRoute).toBeDefined()
  expect(addUserRoute.handle.title).toBe('New user')
  expect(addUserRoute.handle.crumb).toBeUndefined()
})

it('should have correct route structure for BCeID view user', () => {
  const viewUserRoute = organizationRoutes.find(
    (route) => route.path === '/organization/users/:userID'
  )
  expect(viewUserRoute).toBeDefined()
  expect(viewUserRoute.handle.title).toBe('User profile')
  expect(viewUserRoute.handle.crumb).toBeUndefined()
})

describe('Route Elements', () => {
  it('should use Organizations component for list route', () => {
    const listRoute = organizationRoutes.find(
      (route) => route.path === '/organizations'
    )
    expect(listRoute.element.type).toBe(OrganizationsModule.Organizations)
  })

  it('should use OrganizationView with addMode for add organization route', () => {
    const addRoute = organizationRoutes.find(
      (route) => route.path === '/organizations/add-org'
    )
    expect(addRoute.element.type).toBe(OrganizationsModule.OrganizationView)
    expect(addRoute.element.props.addMode).toBe(true)
  })

  it('should use OrganizationView for organization profile route', () => {
    const viewRoute = organizationRoutes.find(
      (route) => route.path === '/organizations/:orgID'
    )
    expect(viewRoute.element.type).toBe(OrganizationsModule.OrganizationView)
    expect(viewRoute.element.props.addMode).toBeUndefined()
  })

  it('should use UserDetailsCard with correct props for add user routes', () => {
    const addUserOrgRoute = organizationRoutes.find(
      (route) => route.path === '/organizations/:orgID/add-user'
    )
    expect(addUserOrgRoute.element.type).toBe(UserDetailsCard)
    expect(addUserOrgRoute.element.props.addMode).toBe(true)
    expect(addUserOrgRoute.element.props.userType).toBe('bceid')

    const addUserBceidRoute = organizationRoutes.find(
      (route) => route.path === '/organization/add-user'
    )
    expect(addUserBceidRoute.element.type).toBe(UserDetailsCard)
    expect(addUserBceidRoute.element.props.addMode).toBe(true)
    expect(addUserBceidRoute.element.props.userType).toBe('bceid') // Updated: now has bceid
  })

  it('should use UserDetailsCard with correct props for view user routes', () => {
    const viewUserOrgRoute = organizationRoutes.find(
      (route) => route.path === '/organizations/:orgID/users/:userID'
    )
    expect(viewUserOrgRoute.element.type).toBe(UserDetailsCard)
    expect(viewUserOrgRoute.element.props.userType).toBe('bceid')
    expect(viewUserOrgRoute.element.props.addMode).toBeUndefined()

    const viewUserBceidRoute = organizationRoutes.find(
      (route) => route.path === '/organization/users/:userID'
    )
    expect(viewUserBceidRoute.element.type).toBe(UserDetailsCard)
    expect(viewUserBceidRoute.element.props.userType).toBe('bceid') // Updated: now has bceid
    expect(viewUserBceidRoute.element.props.addMode).toBeUndefined()
  })
})

describe('Route Handle Properties', () => {
  it('should call all crumb functions without errors', () => {
    organizationRoutes.forEach((route) => {
      if (route.handle?.crumb) {
        expect(typeof route.handle.crumb()).toBe('string')
      }
    })
  })

  it('should have title for all routes', () => {
    organizationRoutes.forEach((route) => {
      expect(route.handle.title).toBeDefined()
      expect(typeof route.handle.title).toBe('string')
    })
  })

  it('should have crumb function only for specific routes', () => {
    const routesWithCrumbs = organizationRoutes.filter(
      (route) => route.handle.crumb
    )
    expect(routesWithCrumbs.length).toBe(4) // Organizations list and organization user view routes

    const expectedCrumbRoutes = [
      '/organizations',
      '/organizations/:orgID/users/:userID',
      '/organizations/:orgID/penalty-log',
      '/organizations/:orgID/penalty-log/manage'
    ]
    routesWithCrumbs.forEach((route) => {
      expect(expectedCrumbRoutes.includes(route.path)).toBe(true)
    })

    // Verify the actual crumb values
    const listRoute = organizationRoutes.find(
      (route) => route.path === '/organizations'
    )
    expect(listRoute.handle.crumb()).toBe('Organizations')

    const viewUserRoute = organizationRoutes.find(
      (route) => route.path === '/organizations/:orgID/users/:userID'
    )
    expect(viewUserRoute.handle.crumb()).toBe('Users')
  })

  describe('Route Structure Validation', () => {
    it('should have elements for all routes', () => {
      organizationRoutes.forEach((route) => {
        expect(route.element).toBeDefined()
        expect(route.path).toBeDefined()
        expect(route.handle).toBeDefined()
      })
    })

    it('should have unique paths for all routes', () => {
      const paths = organizationRoutes.map((route) => route.path)
      const uniquePaths = [...new Set(paths)]
      expect(paths.length).toBe(uniquePaths.length)
    })
  })

  describe('User Type Configurations', () => {
    it('should set userType="bceid" for all user-related routes', () => {
      const allUserRoutes = organizationRoutes.filter((route) =>
        route.path.includes('user') && route.element.props?.userType
      )

      expect(allUserRoutes.length).toBe(4) // Should have 4 UserDetailsCard routes with userType

      allUserRoutes.forEach((route) => {
        expect(route.element.props.userType).toBe('bceid')
      })
    })

    it('should not set userType for organization-only routes', () => {
      const nonUserRoutes = organizationRoutes.filter(
        (route) => !route.path.includes('user')
      )

      nonUserRoutes.forEach((route) => {
        expect(route.element.props.userType).toBeUndefined()
      })
    })
  })

  describe('Add Mode Configurations', () => {
    it('should set addMode=true only for add routes', () => {
      const addRoutes = organizationRoutes.filter((route) =>
        route.path.includes('add')
      )

      addRoutes.forEach((route) => {
        expect(route.element.props.addMode).toBe(true)
      })
    })

    it('should not set addMode for view routes', () => {
      const viewRoutes = organizationRoutes.filter(
        (route) => !route.path.includes('add')
      )

      viewRoutes.forEach((route) => {
        expect(route.element.props.addMode).toBeUndefined()
      })
    })
  })
})
