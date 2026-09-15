import { describe, it, expect, vi } from 'vitest'
import { initiativeAgreementRoutes } from '../initiativeAgreementRoutes'

// Mock the view components
vi.mock('@/views/InitiativeAgreements', () => ({
  InitiativeAgreements: () => 'InitiativeAgreements',
  InitiativeAgreementDetail: () => 'InitiativeAgreementDetail',
  DesignatedActionDetail: () => 'DesignatedActionDetail',
  DesignatedActions: () => 'DesignatedActions'
}))

vi.mock('../routes', () => ({
  __esModule: true,
  default: {
    INITIATIVE_AGREEMENTS: {
      LIST: '/initiative-agreements',
      ACTIONS_LIST: '/initiative-agreements/designated-actions',
      VIEW: '/initiative-agreements/:initiativeAgreementId',
      ACTION_VIEW:
        '/initiative-agreements/:initiativeAgreementId/designated-actions/:designatedActionId'
    }
  }
}))

describe('initiativeAgreementRoutes', () => {
  it('should export the list and detail route configurations', () => {
    expect(Array.isArray(initiativeAgreementRoutes)).toBe(true)
    expect(initiativeAgreementRoutes).toHaveLength(4)
  })

  it('should have correct route structure for the agreements list', () => {
    const listRoute = initiativeAgreementRoutes.find(
      (route) => route.path === '/initiative-agreements'
    )
    expect(listRoute).toBeDefined()
    expect(listRoute.handle.title).toBe('Initiative agreements')
    expect(listRoute.handle.crumb()).toBe('Initiative agreements')
  })

  it('lists every designated action on its own tab route (#5078)', () => {
    const tabRoute = initiativeAgreementRoutes.find(
      (route) => route.path === '/initiative-agreements/designated-actions'
    )
    expect(tabRoute).toBeDefined()
    expect(tabRoute.handle.title).toBe('Designated actions')
    expect(tabRoute.handle.crumb()).toBe('Designated actions')
  })

  it('should have correct route structure for the agreement detail page', () => {
    const detailRoute = initiativeAgreementRoutes.find(
      (route) => route.path === '/initiative-agreements/:initiativeAgreementId'
    )
    expect(detailRoute).toBeDefined()
    expect(detailRoute.handle.title).toBe('Initiative agreement')
    expect(detailRoute.handle.crumb()).toBe('Initiative agreement')
  })

  it('should have correct route structure for the designated action detail', () => {
    const actionRoute = initiativeAgreementRoutes.find(
      (route) =>
        route.path ===
        '/initiative-agreements/:initiativeAgreementId/designated-actions/:designatedActionId'
    )
    expect(actionRoute).toBeDefined()
    expect(actionRoute.handle.title).toBe('Designated action')
    expect(actionRoute.handle.crumb()).toBe('Designated action')
  })
})
