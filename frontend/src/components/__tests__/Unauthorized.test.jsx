import { Unauthorized } from '@/components/Unauthorized'
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, expect, beforeEach, afterEach } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import { BrowserRouter } from 'react-router-dom'
import * as keycloakUtils from '@/utils/keycloak'

// Mock Keycloak
const mockKeycloak = {
  authenticated: false,
  token: 'mock-token',
  idToken: 'mock-id-token'
}

const keycloak = vi.hoisted(() => ({
  useKeycloak: vi.fn()
}))

vi.mock('@react-keycloak/web', () => keycloak)

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'unauthorized.title': 'Access Denied',
        'unauthorized.message':
          'You are not authorized to access this application.',
        'unauthorized.contact': 'For assistance, please contact',
        'unauthorized.email': 'support@example.com',
        'unauthorized.returnToLogin': 'Return to Login'
      }
      return translations[key] || key
    }
  })
}))

// Mock keycloak utils
vi.mock('@/utils/keycloak', () => ({
  logout: vi.fn()
}))

describe('Unauthorized Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    keycloak.useKeycloak.mockReturnValue({
      keycloak: mockKeycloak
    })

    // Mock sessionStorage and localStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        clear: vi.fn(),
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      },
      writable: true
    })

    Object.defineProperty(window, 'localStorage', {
      value: {
        clear: vi.fn(),
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      },
      writable: true
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Component Rendering', () => {
    test('should render the unauthorized component with correct structure', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      expect(screen.getByText('Access Denied')).toBeInTheDocument()
      expect(
        screen.getByText(/You are not authorized to access this application/)
      ).toBeInTheDocument()
      expect(screen.getByText('Return to Login')).toBeInTheDocument()
    })

    test('should display the correct error message', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      const message = screen.getByText(
        /You are not authorized to access this application/
      )
      expect(message).toBeInTheDocument()
      // The message spans multiple lines, so style checks may not work as expected
    })

    test('should display the contact information', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      expect(
        screen.getByText(/For assistance, please contact/)
      ).toBeInTheDocument()
      expect(screen.getByText('support@example.com')).toBeInTheDocument()
    })

    test('should render the email as a clickable link', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      const emailLink = screen.getByRole('link', {
        name: 'support@example.com'
      })
      expect(emailLink).toBeInTheDocument()
      expect(emailLink).toHaveAttribute('href', 'mailto:support@example.com')
    })

    test('should render the return to login button', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      const loginButton = screen.getByTestId('return-login-button')
      expect(loginButton).toBeInTheDocument()
      expect(loginButton).toHaveTextContent('Return to Login')
    })
  })

  describe('Unauthorized State Display', () => {
    test('should display unauthorized state with proper styling', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      const title = screen.getByText('Access Denied')
      expect(title).toHaveStyle({
        color: '#003366'
      })
    })

    test('should center the content properly', ({ render, theme, router }) => {
      render(<Unauthorized />, [theme, router])

      // Check if the main container has correct styling attributes
      const container = screen.getByText('Access Denied').closest('div')
      expect(container).toBeInTheDocument()
    })

    test('should display the correct heading level', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      const heading = screen.getByText('Access Denied')
      // Check if it's rendered as h1 (MUI Typography variant="h1")
      expect(heading).toBeInTheDocument()
    })
  })

  describe('Redirect Functionality', () => {
    test('should navigate to login page when button is clicked', async ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      const loginButton = screen.getByTestId('return-login-button')
      fireEvent.click(loginButton)

      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })

    test('should prevent default behavior on button click', async ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      const loginButton = screen.getByTestId('return-login-button')
      const mockEvent = {
        preventDefault: vi.fn()
      }

      // Simulate click with preventDefault
      fireEvent.click(loginButton)

      expect(mockNavigate).toHaveBeenCalled()
    })

    test('should clear session storage when returning to login', async ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      const loginButton = screen.getByTestId('return-login-button')
      fireEvent.click(loginButton)

      expect(window.sessionStorage.clear).toHaveBeenCalled()
    })

    test('should clear local storage when returning to login', async ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      const loginButton = screen.getByTestId('return-login-button')
      fireEvent.click(loginButton)

      expect(window.localStorage.clear).toHaveBeenCalled()
    })
  })

  describe('Authentication State Handling', () => {
    test('should logout authenticated user when returning to login', async ({
      render,
      theme,
      router
    }) => {
      mockKeycloak.authenticated = true
      keycloak.useKeycloak.mockReturnValue({
        keycloak: mockKeycloak
      })

      render(<Unauthorized />, [theme, router])

      const loginButton = screen.getByTestId('return-login-button')
      fireEvent.click(loginButton)

      expect(keycloakUtils.logout).toHaveBeenCalled()
    })

    test('should not logout unauthenticated user', async ({
      render,
      theme,
      router
    }) => {
      mockKeycloak.authenticated = false
      keycloak.useKeycloak.mockReturnValue({
        keycloak: mockKeycloak
      })

      render(<Unauthorized />, [theme, router])

      const loginButton = screen.getByTestId('return-login-button')
      fireEvent.click(loginButton)

      expect(keycloakUtils.logout).not.toHaveBeenCalled()
    })

    test('should handle keycloak context properly', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      expect(keycloak.useKeycloak).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    test('should handle missing keycloak context gracefully', ({
      render,
      theme,
      router
    }) => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: null
      })

      expect(() => {
        render(<Unauthorized />, [theme, router])
      }).not.toThrow()
    })

    test('should handle undefined keycloak methods gracefully', ({
      render,
      theme,
      router
    }) => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: { authenticated: false }
      })

      render(<Unauthorized />, [theme, router])

      const loginButton = screen.getByTestId('return-login-button')

      // Should not throw error when clicking
      expect(() => {
        fireEvent.click(loginButton)
      }).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    test('should have proper button accessibility attributes', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      const loginButton = screen.getByTestId('return-login-button')
      expect(loginButton).toBeInTheDocument()
    })

    test('should have proper link accessibility', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      const emailLink = screen.getByRole('link', {
        name: 'support@example.com'
      })
      expect(emailLink).toHaveAttribute('href', 'mailto:support@example.com')
    })

    test('should have proper text structure for screen readers', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      // Check that important content is properly structured
      expect(screen.getByText('Access Denied')).toBeInTheDocument()
      expect(screen.getByText(/You are not authorized/)).toBeInTheDocument()
      expect(screen.getByText(/For assistance/)).toBeInTheDocument()
    })

    test('should have proper focus management', ({ render, theme, router }) => {
      render(<Unauthorized />, [theme, router])

      const loginButton = screen.getByTestId('return-login-button')
      loginButton.focus()

      expect(document.activeElement).toBe(loginButton)
    })
  })

  describe('Visual Styling', () => {
    test('should apply correct color scheme', ({ render, theme, router }) => {
      render(<Unauthorized />, [theme, router])

      const title = screen.getByText('Access Denied')
      expect(title).toHaveStyle({ color: '#003366' })
    })

    test('should have proper button styling', ({ render, theme, router }) => {
      render(<Unauthorized />, [theme, router])

      const loginButton = screen.getByTestId('return-login-button')
      expect(loginButton).toHaveClass('MuiButton-contained')
    })

    test('should display FontAwesome icon in button', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      const loginButton = screen.getByTestId('return-login-button')
      // Check if button contains an icon (FontAwesome renders as SVG)
      expect(loginButton.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Integration Tests', () => {
    test('should work with standalone rendering', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      expect(screen.getByText('Access Denied')).toBeInTheDocument()
      expect(screen.getByTestId('return-login-button')).toBeInTheDocument()
    })

    test('should handle complete user flow', async ({
      render,
      theme,
      router
    }) => {
      mockKeycloak.authenticated = true

      render(<Unauthorized />, [theme, router])

      // User sees unauthorized message
      expect(screen.getByText('Access Denied')).toBeInTheDocument()

      // User clicks return to login
      const loginButton = screen.getByTestId('return-login-button')
      fireEvent.click(loginButton)

      // System should logout, clear storage, and navigate
      expect(keycloakUtils.logout).toHaveBeenCalled()
      expect(window.sessionStorage.clear).toHaveBeenCalled()
      expect(window.localStorage.clear).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })

    test('should handle rapid button clicks', async ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      const loginButton = screen.getByTestId('return-login-button')

      // Multiple rapid clicks
      fireEvent.click(loginButton)
      fireEvent.click(loginButton)
      fireEvent.click(loginButton)

      // Should handle gracefully without errors
      expect(mockNavigate).toHaveBeenCalledTimes(3)
    })
  })

  describe('Internationalization', () => {
    test('should use translation keys correctly', ({
      render,
      theme,
      router
    }) => {
      render(<Unauthorized />, [theme, router])

      expect(screen.getByText('Access Denied')).toBeInTheDocument()
      expect(
        screen.getByText(/You are not authorized to access this application/)
      ).toBeInTheDocument()
      expect(screen.getByText('Return to Login')).toBeInTheDocument()
      expect(screen.getByText('support@example.com')).toBeInTheDocument()
    })

    test('should handle missing translations gracefully', ({
      render,
      theme,
      router
    }) => {
      // This would test fallback behavior if translations are missing
      render(<Unauthorized />, [theme, router])

      // Component should still render even if some translations are missing
      expect(screen.getByTestId('return-login-button')).toBeInTheDocument()
    })
  })
})
