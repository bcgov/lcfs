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
  let mockSetTimeout
  let mockClearTimeout

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

  describe('keycloakInitOptions', () => {
    it('should have correct initialization options', () => {
      expect(keycloakInitOptions).toEqual({
        onLoad: 'check-sso',
        pkceMethod: 'S256'
      })
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

  describe('resetInactivityTimer', () => {
    it('should clear existing timer and set a new one', () => {
      // Call the resetInactivityTimer function
      resetInactivityTimer()

      // Verify that clearTimeout was called
      expect(mockClearTimeout).toHaveBeenCalled()

      // Verify that setTimeout was called with the correct timeout (5 minutes)
      expect(mockSetTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        5 * 60 * 1000
      )
    })
  })

  describe('refreshToken', () => {
    it('should not refresh if user is not authenticated', () => {
      // Mock the case where user is not authenticated
      const tempKeycloak = getKeycloak()
      Object.defineProperty(tempKeycloak, 'authenticated', { value: false })
      vi.spyOn(tempKeycloak, 'updateToken')

      // Call the refreshToken function with mocked keycloak
      refreshToken()

      // Verify that updateToken was not called
      expect(tempKeycloak.updateToken).not.toHaveBeenCalled()
    })
  })

  describe('registerActivityEvents', () => {
    it('should add event listeners for all activity events', () => {
      // Call the registerActivityEvents function
      const cleanup = registerActivityEvents()

      // Verify that addEventListener was called for all activity events
      const expectedEvents = [
        'mousedown',
        'keydown',
        'touchstart',
        'scroll',
        'mousemove'
      ]
      expectedEvents.forEach((event) => {
        expect(window.addEventListener).toHaveBeenCalledWith(
          event,
          expect.any(Function),
          { passive: true }
        )
      })

      // Call the cleanup function
      cleanup()

      // Verify that removeEventListener was called for all events
      expectedEvents.forEach((event) => {
        expect(window.removeEventListener).toHaveBeenCalledWith(
          event,
          expect.any(Function)
        )
      })
    })
  })

  describe('initializeTokenRefresh', () => {
    it('should schedule initial token refresh when authenticated', () => {
      // Call the initializeTokenRefresh function
      const cleanup = initializeTokenRefresh()

      // Verify that setTimeout was called to schedule initial refresh
      expect(mockSetTimeout).toHaveBeenCalled()

      // Call the cleanup function
      cleanup()
    })
  })

  // Integration tests
  describe('Integration tests', () => {
    it('should handle the complete token refresh flow', async () => {
      // Mock Date.now for consistent testing
      const originalDateNow = Date.now
      global.Date.now = vi.fn().mockReturnValue(1613135000000) // Fixed timestamp

      // Initialize token refresh
      const cleanup = initializeTokenRefresh()

      // Verify initial timer was set
      expect(mockSetTimeout).toHaveBeenCalled()

      // Simulate token refresh
      await refreshToken()

      // Cleanup
      cleanup()

      // Restore original Date.now
      global.Date.now = originalDateNow
    })

    it('should handle user inactivity timeout', () => {
      // Call resetInactivityTimer
      resetInactivityTimer()

      // Get the callback passed to setTimeout
      const timeoutCallback = mockSetTimeout.mock.calls[0][0]

      // Call the timeout callback to simulate inactivity timeout
      timeoutCallback()

      // Verify setTimeout was called with expected timeout
      expect(mockSetTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        5 * 60 * 1000
      )
    })
  })
})
