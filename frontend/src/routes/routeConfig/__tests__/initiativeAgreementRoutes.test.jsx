import { describe, it, expect, vi } from 'vitest'
import { initiativeAgreementRoutes } from '../initiativeAgreementRoutes'

// Mock the view components
vi.mock('@/views/InitiativeAgreements', () => ({
  InitiativeAgreements: () => 'InitiativeAgreements',
  InitiativeAgreementDetail: () => 'InitiativeAgreementDetail'
}))

vi.mock('../routes', () => ({
  __esModule: true,
  default: {
    INITIATIVE_AGREEMENTS: {
      LIST: '/initiative-agreements',
      VIEW: '/initiative-agreements/:initiativeAgreementId'
    }
  }
}))

describe('initiativeAgreementRoutes', () => {
  it('should export the list and detail route configurations', () => {
    expect(Array.isArray(initiativeAgreementRoutes)).toBe(true)
    expect(initiativeAgreementRoutes).toHaveLength(2)
  })

  it('should have correct route structure for the agreements list', () => {
    const listRoute = initiativeAgreementRoutes.find(
      (route) => route.path === '/initiative-agreements'
    )
    expect(listRoute).toBeDefined()
    expect(listRoute.handle.title).toBe('Initiative agreements')
    expect(listRoute.handle.crumb()).toBe('Initiative agreements')
  })

  it('should have correct route structure for the agreement detail page', () => {
    const detailRoute = initiativeAgreementRoutes.find(
      (route) => route.path === '/initiative-agreements/:initiativeAgreementId'
    )
    expect(detailRoute).toBeDefined()
    expect(detailRoute.handle.title).toBe('Initiative agreement')
    expect(detailRoute.handle.crumb()).toBe('Initiative agreement')
  })
})
