import { describe, it, expect, vi } from 'vitest'
import { organizationRoutes } from '../organizationRoutes'

// Mock the view components
vi.mock('@/views/Organizations', () => ({
  Organizations: () => 'Organizations',
  AddEditOrg: () => 'AddEditOrg',
  OrganizationView: () => 'OrganizationView'
}))

vi.mock('@/views/Users', () => ({
  AddEditUser: () => 'AddEditUser'
}))

vi.mock('@/views/Admin/AdminMenu/components/ViewUser', () => ({
  __esModule: true,
  default: () => 'ViewUser'
}))

vi.mock('../routes', () => ({
  __esModule: true,
  default: {
    ORGANIZATIONS: {
      LIST: '/organizations',
      ADD: '/organizations/add-org',
      VIEW: '/organizations/:orgID',
      EDIT: '/organizations/:orgID/edit-org',
      ADD_USER: '/organizations/:orgID/add-user',
      VIEW_USER: '/organizations/:orgID/:userID',
      EDIT_USER: '/organizations/:orgID/:userID/edit-user'
    },
    ORGANIZATION: {
      ORG: '/organization',
      ADD_USER: '/organization/add-user',
      VIEW_USER: '/organization/:userID',
      EDIT_USER: '/organization/:userID/edit-user'
    }
  }
}))

describe('organizationRoutes', () => {
  it('should export an array of route configurations', () => {
    expect(Array.isArray(organizationRoutes)).toBe(true)
    expect(organizationRoutes.length).toBeGreaterThan(0)
  })

  it('should have correct route structure for organizations list', () => {
    const listRoute = organizationRoutes.find(route => route.path === '/organizations')
    expect(listRoute).toBeDefined()
    expect(listRoute.handle.title).toBe('Organizations')
    expect(listRoute.handle.crumb()).toBe('Organizations')
  })

  it('should have correct route structure for add organization', () => {
    const addRoute = organizationRoutes.find(route => route.path === '/organizations/add-org')
    expect(addRoute).toBeDefined()
    expect(addRoute.handle.title).toBe('Add organization')
  })

  it('should have correct route structure for view organization', () => {
    const viewRoute = organizationRoutes.find(route => route.path === '/organizations/:orgID')
    expect(viewRoute).toBeDefined()
    expect(viewRoute.handle.title).toBe('View organization')
  })

  it('should have correct route structure for edit organization', () => {
    const editRoute = organizationRoutes.find(route => route.path === '/organizations/:orgID/edit-org')
    expect(editRoute).toBeDefined()
    expect(editRoute.handle.title).toBe('Edit organization')
  })

  it('should have correct route structure for add user', () => {
    const addUserRoute = organizationRoutes.find(route => route.path === '/organizations/:orgID/add-user')
    expect(addUserRoute).toBeDefined()
    expect(addUserRoute.handle.title).toBe('New user')
  })

  it('should have correct route structure for view user', () => {
    const viewUserRoute = organizationRoutes.find(route => route.path === '/organizations/:orgID/:userID')
    expect(viewUserRoute).toBeDefined()
    expect(viewUserRoute.handle.title).toBe('View user')
    expect(viewUserRoute.handle.crumb()).toBe('Users')
  })

  it('should have correct route structure for edit user', () => {
    const editUserRoute = organizationRoutes.find(route => route.path === '/organizations/:orgID/:userID/edit-user')
    expect(editUserRoute).toBeDefined()
    expect(editUserRoute.handle.title).toBe('Edit user')
    expect(editUserRoute.handle.crumb()).toBe('Users')
  })

  it('should have correct route structure for organization (BCeID)', () => {
    const orgRoute = organizationRoutes.find(route => route.path === '/organization')
    expect(orgRoute).toBeDefined()
    expect(orgRoute.handle.title).toBe('Organization')
  })

  it('should have correct route structure for BCeID add user', () => {
    const addUserRoute = organizationRoutes.find(route => route.path === '/organization/add-user')
    expect(addUserRoute).toBeDefined()
    expect(addUserRoute.handle.title).toBe('New user')
  })

  it('should have correct route structure for BCeID view user', () => {
    const viewUserRoute = organizationRoutes.find(route => route.path === '/organization/:userID')
    expect(viewUserRoute).toBeDefined()
    expect(viewUserRoute.handle.title).toBe('View user')
  })

  it('should have correct route structure for BCeID edit user', () => {
    const editUserRoute = organizationRoutes.find(route => route.path === '/organization/:userID/edit-user')
    expect(editUserRoute).toBeDefined()
    expect(editUserRoute.handle.title).toBe('Edit user')
  })

  it('should call all crumb functions', () => {
    // Test all crumb functions to ensure 100% function coverage
    organizationRoutes.forEach(route => {
      if (route.handle?.crumb) {
        expect(typeof route.handle.crumb()).toBe('string')
      }
    })
  })

  it('should have elements for all routes', () => {
    organizationRoutes.forEach(route => {
      expect(route.element).toBeDefined()
      expect(route.path).toBeDefined()
      expect(route.handle).toBeDefined()
    })
  })
})