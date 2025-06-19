import {
  KeycloakProvider,
  KeycloakContext
} from '@/components/KeycloakProvider'
import { apiRoutes } from '@/constants/routes'
import { CONFIG } from '@/constants/config'
import { render, screen, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useContext } from 'react'

// Mock all dependencies first
vi.mock('@/utils/keycloak', () => ({
  getKeycloak: vi.fn(() => ({
    authenticated: false,
    token: 'mock-token',
    idToken: 'mock-id-token',
    tokenParsed: { exp: Date.now() / 1000 + 3600 },
    updateToken: vi.fn().mockResolvedValue(true),
    endpoints: {
      logout: vi.fn(() => 'http://localhost:8080/logout')
    },
    clientId: 'test-client'
  })),
  logout: vi.fn()
}))

vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} })
  }
}))

vi.mock('@react-keycloak/web', () => ({
  ReactKeycloakProvider: ({ children }) => children
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-testid="loading">Loading...</div>
}))

vi.mock('@/constants/config', () => ({
  CONFIG: {
    API_BASE: 'http://localhost:8000'
  }
}))

vi.mock('@/constants/routes', () => ({
  apiRoutes: {
    trackUserLogin: '/track-login'
  }
}))

// Test component to consume context
const TestConsumer = () => {
  const context = useContext(KeycloakContext)
  return (
    <div>
      <div data-test="context-available">
        {context ? 'Available' : 'Not Available'}
      </div>
      <div data-test="keycloak-authenticated">
        {context?.keycloak?.authenticated ? 'Yes' : 'No'}
      </div>
      <button
        data-test="refresh-token-button"
        onClick={() => context?.refreshToken?.()}
      >
        Refresh Token
      </button>
    </div>
  )
}

describe('KeycloakProvider', () => {
  let originalLocalStorage

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Mock localStorage
    originalLocalStorage = global.localStorage
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
    global.localStorage = originalLocalStorage
  })

  describe('Basic Functionality', () => {
    it('should render children when initialized', () => {
      render(
        <KeycloakProvider>
          <div data-test="child">Child Component</div>
        </KeycloakProvider>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('should provide keycloak context to children', () => {
      render(
        <KeycloakProvider>
          <TestConsumer />
        </KeycloakProvider>
      )

      expect(screen.getByTestId('context-available')).toHaveTextContent(
        'Available'
      )
    })

    it('should initialize with unauthenticated state by default', () => {
      render(
        <KeycloakProvider>
          <TestConsumer />
        </KeycloakProvider>
      )

      expect(screen.getByTestId('keycloak-authenticated')).toHaveTextContent(
        'No'
      )
    })
  })

  describe('Token Refresh', () => {
    it('should provide refresh token function', async () => {
      render(
        <KeycloakProvider>
          <TestConsumer />
        </KeycloakProvider>
      )

      const refreshButton = screen.getByTestId('refresh-token-button')
      expect(refreshButton).toBeInTheDocument()

      await act(async () => {
        refreshButton.click()
      })

      // Should not throw error
    })
  })

  describe('User Activity Tracking', () => {
    it('should set up event listeners for user activity', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

      render(
        <KeycloakProvider>
          <div>Test</div>
        </KeycloakProvider>
      )

      const expectedEvents = [
        'mousemove',
        'mousedown',
        'keydown',
        'scroll',
        'wheel',
        'touchstart'
      ]

      expectedEvents.forEach((event) => {
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          event,
          expect.any(Function)
        )
      })

      addEventListenerSpy.mockRestore()
    })

    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = render(
        <KeycloakProvider>
          <div>Test</div>
        </KeycloakProvider>
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalled()
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('Cleanup', () => {
    it('should handle unmounting gracefully', () => {
      const { unmount } = render(
        <KeycloakProvider>
          <div>Test</div>
        </KeycloakProvider>
      )

      expect(() => unmount()).not.toThrow()
    })
  })
})
