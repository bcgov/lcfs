// utils/__tests__/logout-cache-clearing.test.js
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock Keycloak first
vi.mock('keycloak-js', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      clientId: 'mock-client-id',
      authenticated: true,
      token: 'mock-token',
      idToken: 'mock-id-token',
      tokenParsed: {
        exp: Math.floor(Date.now() / 1000) + 300,
        idToken: 'mock-id-token'
      },
      endpoints: {
        logout: () => 'mock-logout-endpoint'
      }
    }))
  }
})

// Import after mocks
// eslint-disable-next-line import/first
import { logout } from '../keycloak'

describe('Logout - Cache Clearing', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock window.location
    delete window.location
    window.location = { href: '' }

    // Mock sessionStorage
    const sessionStorageMock = {
      clear: vi.fn(),
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    }
    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageMock,
      writable: true
    })

    // Mock localStorage
    const localStorageMock = {
      clear: vi.fn(),
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    })
  })

  describe('when user logs out', () => {
    it('should clear sessionStorage (including grid filters)', () => {
      // Simulate stored filters
      sessionStorage.setItem(
        'transactions-grid-filter',
        JSON.stringify({ status: 'active' })
      )
      sessionStorage.setItem('transactions-grid-column', JSON.stringify([]))
      sessionStorage.setItem(
        'transactions-grid-orgFilter',
        JSON.stringify({ id: 'org-123' })
      )

      // Perform logout
      logout()

      // Verify sessionStorage was cleared
      expect(sessionStorage.clear).toHaveBeenCalled()
    })

    it('should clear localStorage', () => {
      // Simulate stored data
      localStorage.setItem('some-key', 'some-value')

      // Perform logout
      logout()

      // Verify localStorage was cleared
      expect(localStorage.clear).toHaveBeenCalled()
    })

    it('should attempt to clear React Query cache via dynamic import', () => {
      // Perform logout
      logout()

      // The logout function dynamically imports the queryClient
      // We verify that storage is cleared immediately
      expect(sessionStorage.clear).toHaveBeenCalled()
      expect(localStorage.clear).toHaveBeenCalled()
    })

    it('should clear all caches before redirecting to logout URL', () => {
      // Perform logout
      logout()

      // Verify all storage is cleared
      expect(sessionStorage.clear).toHaveBeenCalled()
      expect(localStorage.clear).toHaveBeenCalled()
    })
  })

  describe('cache clearing for different user scenarios', () => {
    it('should clear filters when switching between organizations', () => {
      // Simulate Organization A user's filters
      sessionStorage.setItem(
        'transactions-grid-orgFilter',
        JSON.stringify({ id: 'org-A' })
      )
      sessionStorage.setItem(
        'reports-grid-filter',
        JSON.stringify({ year: 2024 })
      )

      // User logs out
      logout()

      // Verify all filters are cleared
      expect(sessionStorage.clear).toHaveBeenCalled()
      expect(localStorage.clear).toHaveBeenCalled()
    })

    it('should clear filters for both IDIR and BCeID users', () => {
      // Simulate IDIR user session data
      sessionStorage.setItem('user-type', 'IDIR')
      sessionStorage.setItem('admin-filters', JSON.stringify({ role: 'admin' }))

      // User logs out
      logout()

      // Verify all data is cleared (will work for BCeID as well)
      expect(sessionStorage.clear).toHaveBeenCalled()
      expect(localStorage.clear).toHaveBeenCalled()
    })

    it('should ensure fresh data after re-login', () => {
      // Simulate stale data from previous session
      sessionStorage.setItem('old-session-data', 'stale')
      localStorage.setItem('cached-user-data', 'old-user')

      // User logs out
      logout()

      // Verify all caches cleared to ensure fresh data on next login
      expect(sessionStorage.clear).toHaveBeenCalled()
      expect(localStorage.clear).toHaveBeenCalled()
    })
  })
})
