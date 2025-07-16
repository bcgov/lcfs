import { describe, it, expect, vi } from 'vitest'
import { transactionRoutes } from '../transactionRoutes'

// Mock the view components
vi.mock('@/views/Transactions', () => ({
  Transactions: () => 'Transactions',
  AddEditViewTransaction: () => 'AddEditViewTransaction',
  ViewOrgTransaction: () => 'ViewOrgTransaction'
}))

vi.mock('../routes', () => ({
  __esModule: true,
  default: {
    TRANSACTIONS: {
      LIST: '/transactions',
      ADD: '/transactions/add',
      EDIT: '/transactions/edit/:transactionId',
      VIEW: '/transactions/:transactionId',
      ADMIN_ADJUSTMENT: {
        VIEW: '/admin-adjustment/:transactionId',
        ORG_VIEW: '/org-admin-adjustment/:transactionId',
        EDIT: '/admin-adjustment/edit/:transactionId'
      },
      INITIATIVE_AGREEMENT: {
        VIEW: '/initiative-agreement/:transactionId',
        ORG_VIEW: '/org-initiative-agreement/:transactionId',
        EDIT: '/initiative-agreement/edit/:transactionId'
      }
    }
  }
}))

describe('transactionRoutes', () => {
  it('should export an array of route configurations', () => {
    expect(Array.isArray(transactionRoutes)).toBe(true)
    expect(transactionRoutes.length).toBeGreaterThan(0)
  })

  it('should have correct route structure for transactions list', () => {
    const listRoute = transactionRoutes.find(route => route.path === '/transactions')
    expect(listRoute).toBeDefined()
    expect(listRoute.handle.title).toBe('Transactions')
    expect(listRoute.handle.crumb()).toBe('Transactions')
  })

  it('should have correct route structure for add transaction', () => {
    const addRoute = transactionRoutes.find(route => route.path === '/transactions/add')
    expect(addRoute).toBeDefined()
    expect(addRoute.handle.title).toBe('New transaction')
    expect(addRoute.handle.mode).toBe('add')
  })

  it('should have correct route structure for edit transaction', () => {
    const editRoute = transactionRoutes.find(route => route.path === '/transactions/edit/:transactionId')
    expect(editRoute).toBeDefined()
    expect(editRoute.handle.title).toBe('Edit transaction')
    expect(editRoute.handle.mode).toBe('edit')
  })

  it('should have correct route structure for view transaction', () => {
    const viewRoute = transactionRoutes.find(route => route.path === '/transactions/:transactionId')
    expect(viewRoute).toBeDefined()
    expect(viewRoute.handle.title).toBe('View transaction')
    expect(viewRoute.handle.mode).toBe('view')
  })

  it('should have correct route structure for admin adjustment view', () => {
    const adminViewRoute = transactionRoutes.find(route => route.path === '/admin-adjustment/:transactionId')
    expect(adminViewRoute).toBeDefined()
    expect(adminViewRoute.handle.title).toBe('Admin adjustment')
    expect(adminViewRoute.handle.mode).toBe('view')
  })

  it('should have correct route structure for admin adjustment org view', () => {
    const adminOrgViewRoute = transactionRoutes.find(route => route.path === '/org-admin-adjustment/:transactionId')
    expect(adminOrgViewRoute).toBeDefined()
    expect(adminOrgViewRoute.handle.title).toBe('Admin adjustment')
  })

  it('should have correct route structure for admin adjustment edit', () => {
    const adminEditRoute = transactionRoutes.find(route => route.path === '/admin-adjustment/edit/:transactionId')
    expect(adminEditRoute).toBeDefined()
    expect(adminEditRoute.handle.title).toBe('Edit admin adjustment')
    expect(adminEditRoute.handle.mode).toBe('edit')
  })

  it('should have correct route structure for initiative agreement view', () => {
    const initiativeViewRoute = transactionRoutes.find(route => route.path === '/initiative-agreement/:transactionId')
    expect(initiativeViewRoute).toBeDefined()
    expect(initiativeViewRoute.handle.title).toBe('Initiative agreement')
    expect(initiativeViewRoute.handle.mode).toBe('view')
  })

  it('should have correct route structure for initiative agreement org view', () => {
    const initiativeOrgViewRoute = transactionRoutes.find(route => route.path === '/org-initiative-agreement/:transactionId')
    expect(initiativeOrgViewRoute).toBeDefined()
    expect(initiativeOrgViewRoute.handle.title).toBe('Initiative agreement')
  })

  it('should have correct route structure for initiative agreement edit', () => {
    const initiativeEditRoute = transactionRoutes.find(route => route.path === '/initiative-agreement/edit/:transactionId')
    expect(initiativeEditRoute).toBeDefined()
    expect(initiativeEditRoute.handle.title).toBe('Edit initiative agreement')
    expect(initiativeEditRoute.handle.mode).toBe('edit')
  })

  it('should call all crumb functions', () => {
    // Test all crumb functions to ensure 100% function coverage
    transactionRoutes.forEach(route => {
      if (route.handle?.crumb) {
        expect(typeof route.handle.crumb()).toBe('string')
      }
    })
  })

  it('should have elements for all routes', () => {
    transactionRoutes.forEach(route => {
      expect(route.element).toBeDefined()
      expect(route.path).toBeDefined()
      expect(route.handle).toBeDefined()
    })
  })

  it('should have correct modes for transaction routes', () => {
    const routesWithModes = transactionRoutes.filter(route => route.handle?.mode)
    expect(routesWithModes.length).toBeGreaterThan(0)
    
    routesWithModes.forEach(route => {
      expect(['add', 'edit', 'view']).toContain(route.handle.mode)
    })
  })
})