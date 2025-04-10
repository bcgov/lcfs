// utils/__tests__/keycloak.test.js
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock Keycloak class first
vi.mock('keycloak-js', () => {
  const mockUpdateToken = vi
    .fn()
    .mockImplementation(() => Promise.resolve(true))
  return {
    default: vi.fn().mockImplementation(() => ({
      clientId: 'mock-client-id',
      authenticated: true,
      token: 'mock-token',
      idToken: 'mock-id-token',
      tokenParsed: {
        exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes expiry
        idToken: 'mock-id-token'
      },
      updateToken: mockUpdateToken,
      endpoints: {
        logout: () => 'mock-logout-endpoint'
      }
    }))
  }
})

// Import the module after the mocks are set up
// eslint-disable-next-line import/first
import {
  getKeycloak,
  refreshToken,
  logout,
  resetInactivityTimer,
  registerActivityEvents,
  initializeTokenRefresh,
  keycloakInitOptions
} from '../keycloak'

describe('Keycloak Utils', () => {
  let keycloak
  let mockSetTimeout
  let mockClearTimeout
  let logoutSpy

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks()
    vi.restoreAllMocks()

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock setTimeout and clearTimeout
    mockSetTimeout = vi.fn().mockImplementation((fn, delay) => {
      return 123 // Mock timer ID
    })
    mockClearTimeout = vi.fn()
    vi.spyOn(global, 'setTimeout').mockImplementation(mockSetTimeout)
    vi.spyOn(global, 'clearTimeout').mockImplementation(mockClearTimeout)
    // eslint-disable-next-line no-proto
    vi.spyOn(window.localStorage.__proto__, 'removeItem').mockImplementation(
      () => {}
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock window.location
    delete window.location
    window.location = {
      href: 'https://example.com',
      assign: vi.fn()
    }
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://example.com'
      },
      writable: true
    })

    // Mock localStorage
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => null)
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {})

    // Mock addEventListener and removeEventListener
    vi.spyOn(window, 'addEventListener').mockImplementation(() => {})
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {})

    // Get a reference to the mocked keycloak instance
    keycloak = getKeycloak()

    // Create a spy on logout function
    logoutSpy = vi.spyOn({ logout }, 'logout')
  })

  afterEach(() => {
    // Restore all mocks
    vi.restoreAllMocks()
  })

  describe('getKeycloak', () => {
    it('should return a keycloak instance', () => {
      const instance = getKeycloak()
      expect(instance).toBeDefined()
    })
  })

  describe('logout', () => {
    it('should clear local storage when logging out', () => {
      // Call the logout function
      logout()

      // Verify that local storage item was removed
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(
        'keycloak-logged-in'
      )

      // Verify that clearTimeout was called to clear inactivity timer
      expect(mockClearTimeout).toHaveBeenCalled()
    })

    it('should handle missing idToken', () => {
      // Mock the case where idToken is missing
      const tempKeycloak = getKeycloak()
      Object.defineProperty(tempKeycloak, 'idToken', { value: null })
      Object.defineProperty(tempKeycloak, 'tokenParsed', {
        value: { ...tempKeycloak.tokenParsed, idToken: null }
      })

      // Call the logout function with reassigned keycloak
      vi.spyOn(console, 'error')
      logout()

      // Verify that console.error was called
      expect(console.error).toHaveBeenCalled()
    })
  })
})
