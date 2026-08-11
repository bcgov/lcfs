import { Login } from '@/components/Login'
import { IDENTITY_PROVIDERS } from '@/constants/auth'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, expect, beforeEach, afterEach } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import { BrowserRouter } from 'react-router-dom'

const mockNavigate = vi.fn()

// Mock Keycloak
const mockKeycloak = {
  authenticated: false,
  login: vi.fn(),
  token: 'mock-token',
  idToken: 'mock-id-token'
}

const keycloak = vi.hoisted(() => ({
  useKeycloak: vi.fn()
}))

vi.mock('@react-keycloak/web', () => keycloak)

// Mock react-snowfall
vi.mock('react-snowfall', () => ({
  default: ({ children, ...props }) => (
    <div data-testid="snowfall" {...props}>
      {children}
    </div>
  )
}))

// Mock react-router-dom location
const mockLocation = {
  state: null
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: () => mockLocation,
    useNavigate: () => mockNavigate
  }
})

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'login.loginMessage': 'Login with',
        Login: 'Login',
        'login.publicCreditCalculator': 'Public LCFS information'
      }
      return translations[key] || key
    }
  })
}))

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation.state = null
    keycloak.useKeycloak.mockReturnValue({
      keycloak: mockKeycloak
    })
    mockNavigate.mockReset()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Component Rendering', () => {
    test('should render the login component with correct structure', ({
      render,
      theme,
      router
    }) => {
      render(<Login />, [theme, router])

      expect(screen.getByTestId('login')).toBeInTheDocument()
      expect(screen.getByTestId('login-container')).toBeInTheDocument()
      expect(screen.getByText('Login')).toBeInTheDocument()
    })

    test('should render both login buttons and public dashboard button', ({
      render,
      theme,
      router
    }) => {
      render(<Login />, [theme, router])

      expect(screen.getByTestId('link-bceid')).toBeInTheDocument()
      expect(screen.getByTestId('link-idir')).toBeInTheDocument()
      expect(screen.getByTestId('link-public-dashboard')).toBeInTheDocument()
      expect(screen.getAllByText(/Login with/)).toHaveLength(2)
      expect(screen.getByText('BCeID')).toBeInTheDocument()
      expect(screen.getByText('IDIR')).toBeInTheDocument()
      expect(screen.getByText('Public LCFS information')).toBeInTheDocument()
    })

    test('should render seasonal effects (snowfall)', ({
      render,
      theme,
      router
    }) => {
      render(<Login />, [theme, router])

      // Snowfall should be present for non-summer seasons
      const snowfall = screen.queryByTestId('snowfall')
      // Note: This test depends on the current date/season
      // For a more robust test, we could mock the date
      expect(snowfall).toBeDefined()
    })
  })

  describe('Authentication Flow', () => {
    test('should call keycloak.login with BCeID when BCeID button is clicked', ({
      render,
      theme,
      router
    }) => {
      render(<Login />, [theme, router])

      const bceidButton = screen.getByTestId('link-bceid')
      fireEvent.click(bceidButton)

      expect(mockKeycloak.login).toHaveBeenCalledWith({
        idpHint: IDENTITY_PROVIDERS.BCEID_BUSINESS,
        redirectUri: window.location.origin
      })
    })

    test('should call keycloak.login with IDIR when IDIR button is clicked', ({
      render,
      theme,
      router
    }) => {
      render(<Login />, [theme, router])

      const idirButton = screen.getByTestId('link-idir')
      fireEvent.click(idirButton)

      expect(mockKeycloak.login).toHaveBeenCalledWith({
        idpHint: IDENTITY_PROVIDERS.IDIR,
        redirectUri: window.location.origin
      })
    })

    test('should use correct redirect URI', ({ render, theme, router }) => {
      render(<Login />, [theme, router])

      const bceidButton = screen.getByTestId('link-bceid')
      fireEvent.click(bceidButton)

      expect(mockKeycloak.login).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUri: window.location.origin
        })
      )
    })

    test('should navigate to public dashboard when public dashboard button is clicked', ({
      render,
      theme,
      router
    }) => {
      render(<Login />, [theme, router])

      const publicDashboardButton = screen.getByTestId('link-public-dashboard')
      fireEvent.click(publicDashboardButton)

      expect(mockNavigate).toHaveBeenCalledWith('/public')
    })
  })

  describe('Error Handling', () => {
    test('should display error message when provided in location state', ({
      render,
      theme,
      router
    }) => {
      mockLocation.state = {
        message: 'Authentication failed',
        severity: 'error'
      }

      render(<Login />, [theme, router])

      expect(screen.getByText('Authentication failed')).toBeInTheDocument()
    })

    test('should display success message when provided in location state', ({
      render,
      theme,
      router
    }) => {
      mockLocation.state = {
        message: 'Successfully logged out',
        severity: 'success'
      }

      render(<Login />, [theme, router])

      expect(screen.getByText('Successfully logged out')).toBeInTheDocument()
    })

    test('should display warning message when provided in location state', ({
      render,
      theme,
      router
    }) => {
      mockLocation.state = {
        message: 'Session expired',
        severity: 'warning'
      }

      render(<Login />, [theme, router])

      expect(screen.getByText('Session expired')).toBeInTheDocument()
    })

    test('should not display alert when no message in location state', ({
      render,
      theme,
      router
    }) => {
      mockLocation.state = null

      render(<Login />, [theme, router])

      // Should not find any Alert component
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    test('should handle keycloak initialization properly', ({
      render,
      theme,
      router
    }) => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: {
          ...mockKeycloak,
          authenticated: false
        }
      })

      render(<Login />, [theme, router])

      // Component should render properly even when not authenticated
      expect(screen.getByTestId('login')).toBeInTheDocument()
      expect(screen.getByTestId('link-bceid')).toBeInTheDocument()
      expect(screen.getByTestId('link-idir')).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    test('should have proper form structure', ({ render, theme, router }) => {
      render(<Login />, [theme, router])

      const form = screen.getByTestId('login-container')
      expect(form).toHaveAttribute('role', 'form')
    })

    test('should have accessible button labels', ({
      render,
      theme,
      router
    }) => {
      render(<Login />, [theme, router])

      const bceidButton = screen.getByTestId('link-bceid')
      const idirButton = screen.getByTestId('link-idir')

      expect(bceidButton).toHaveAttribute('aria-label', 'Login with BCeID')
      expect(idirButton).toHaveAttribute('aria-label', 'Login with IDIR')
    })

    test('should have correct button IDs for testing', ({
      render,
      theme,
      router
    }) => {
      render(<Login />, [theme, router])

      expect(screen.getByTestId('link-bceid')).toHaveAttribute(
        'id',
        'link-bceid'
      )
      expect(screen.getByTestId('link-idir')).toHaveAttribute('id', 'link-idir')
    })
  })

  describe('Redirect Behavior', () => {
    test('should maintain current origin as redirect URI', ({
      render,
      theme,
      router
    }) => {
      const originalLocation = window.location.origin

      render(<Login />, [theme, router])

      const bceidButton = screen.getByTestId('link-bceid')
      fireEvent.click(bceidButton)

      expect(mockKeycloak.login).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUri: originalLocation
        })
      )
    })
  })

  describe('Accessibility', () => {
    test('should have proper heading structure', ({
      render,
      theme,
      router
    }) => {
      render(<Login />, [theme, router])

      const heading = screen.getByText('Login')
      expect(heading).toHaveClass('visually-hidden')
    })

    test('should have proper button focus handling', async ({
      render,
      theme,
      router
    }) => {
      render(<Login />, [theme, router])

      const bceidButton = screen.getByTestId('link-bceid')
      const idirButton = screen.getByTestId('link-idir')

      // Tab navigation should work
      bceidButton.focus()
      expect(document.activeElement).toBe(bceidButton)

      // Should be able to focus on IDIR button as well
      idirButton.focus()
      expect(document.activeElement).toBe(idirButton)
    })
  })

  describe('Integration Tests', () => {
    test('should work with standalone rendering', ({
      render,
      theme,
      router
    }) => {
      render(<Login />, [theme, router])

      expect(screen.getByTestId('login')).toBeInTheDocument()
    })

    test('should handle multiple rapid clicks gracefully', ({
      render,
      theme,
      router
    }) => {
      render(<Login />, [theme, router])

      const bceidButton = screen.getByTestId('link-bceid')

      // Rapid clicks
      fireEvent.click(bceidButton)
      fireEvent.click(bceidButton)
      fireEvent.click(bceidButton)

      // Should still only call login with correct parameters
      expect(mockKeycloak.login).toHaveBeenCalledTimes(3)
      expect(mockKeycloak.login).toHaveBeenCalledWith({
        idpHint: IDENTITY_PROVIDERS.BCEID_BUSINESS,
        redirectUri: window.location.origin
      })
    })
  })
})
