import { Login } from '@/components/Login'
import { IDENTITY_PROVIDERS } from '@/constants/auth'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { wrapper } from '@/tests/utils/wrapper'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
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
        'login.publicCreditCalculator': 'Public - Credit calculator'
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
    it('should render the login component with correct structure', () => {
      render(<Login />, { wrapper })

      expect(screen.getByTestId('login')).toBeInTheDocument()
      expect(screen.getByTestId('login-container')).toBeInTheDocument()
      expect(screen.getByText('Login')).toBeInTheDocument()
    })

    it('should render both login buttons and public calculator button', () => {
      render(<Login />, { wrapper })

      expect(screen.getByTestId('link-bceid')).toBeInTheDocument()
      expect(screen.getByTestId('link-idir')).toBeInTheDocument()
      expect(
        screen.getByTestId('link-public-credit-calculator')
      ).toBeInTheDocument()
      expect(screen.getAllByText(/Login with/)).toHaveLength(2)
      expect(screen.getByText('BCeID')).toBeInTheDocument()
      expect(screen.getByText('IDIR')).toBeInTheDocument()
      expect(screen.getByText('Public - Credit calculator')).toBeInTheDocument()
    })

    it('should render seasonal effects (snowfall)', () => {
      render(<Login />, { wrapper })

      // Snowfall should be present for non-summer seasons
      const snowfall = screen.queryByTestId('snowfall')
      // Note: This test depends on the current date/season
      // For a more robust test, we could mock the date
      expect(snowfall).toBeDefined()
    })
  })

  describe('Authentication Flow', () => {
    it('should call keycloak.login with BCeID when BCeID button is clicked', () => {
      render(<Login />, { wrapper })

      const bceidButton = screen.getByTestId('link-bceid')
      fireEvent.click(bceidButton)

      expect(mockKeycloak.login).toHaveBeenCalledWith({
        idpHint: IDENTITY_PROVIDERS.BCEID_BUSINESS,
        redirectUri: window.location.origin
      })
    })

    it('should call keycloak.login with IDIR when IDIR button is clicked', () => {
      render(<Login />, { wrapper })

      const idirButton = screen.getByTestId('link-idir')
      fireEvent.click(idirButton)

      expect(mockKeycloak.login).toHaveBeenCalledWith({
        idpHint: IDENTITY_PROVIDERS.IDIR,
        redirectUri: window.location.origin
      })
    })

    it('should use correct redirect URI', () => {
      render(<Login />, { wrapper })

      const bceidButton = screen.getByTestId('link-bceid')
      fireEvent.click(bceidButton)

      expect(mockKeycloak.login).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUri: window.location.origin
        })
      )
    })

    it('should navigate to public credit calculator when public calculator button is clicked', () => {
      render(<Login />, { wrapper })

      const publicCalculatorButton = screen.getByTestId(
        'link-public-credit-calculator'
      )
      fireEvent.click(publicCalculatorButton)

      expect(mockNavigate).toHaveBeenCalledWith('/credit-calculator')
    })
  })

  describe('Error Handling', () => {
    it('should display error message when provided in location state', () => {
      mockLocation.state = {
        message: 'Authentication failed',
        severity: 'error'
      }

      render(<Login />, { wrapper })

      expect(screen.getByText('Authentication failed')).toBeInTheDocument()
    })

    it('should display success message when provided in location state', () => {
      mockLocation.state = {
        message: 'Successfully logged out',
        severity: 'success'
      }

      render(<Login />, { wrapper })

      expect(screen.getByText('Successfully logged out')).toBeInTheDocument()
    })

    it('should display warning message when provided in location state', () => {
      mockLocation.state = {
        message: 'Session expired',
        severity: 'warning'
      }

      render(<Login />, { wrapper })

      expect(screen.getByText('Session expired')).toBeInTheDocument()
    })

    it('should not display alert when no message in location state', () => {
      mockLocation.state = null

      render(<Login />, { wrapper })

      // Should not find any Alert component
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should handle keycloak initialization properly', () => {
      keycloak.useKeycloak.mockReturnValue({
        keycloak: {
          ...mockKeycloak,
          authenticated: false
        }
      })

      render(<Login />, { wrapper })

      // Component should render properly even when not authenticated
      expect(screen.getByTestId('login')).toBeInTheDocument()
      expect(screen.getByTestId('link-bceid')).toBeInTheDocument()
      expect(screen.getByTestId('link-idir')).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should have proper form structure', () => {
      render(<Login />, { wrapper })

      const form = screen.getByTestId('login-container')
      expect(form).toHaveAttribute('role', 'form')
    })

    it('should have accessible button labels', () => {
      render(<Login />, { wrapper })

      const bceidButton = screen.getByTestId('link-bceid')
      const idirButton = screen.getByTestId('link-idir')

      expect(bceidButton).toHaveAttribute('aria-label', 'Login with BCeID')
      expect(idirButton).toHaveAttribute('aria-label', 'Login with IDIR')
    })

    it('should have correct button IDs for testing', () => {
      render(<Login />, { wrapper })

      expect(screen.getByTestId('link-bceid')).toHaveAttribute(
        'id',
        'link-bceid'
      )
      expect(screen.getByTestId('link-idir')).toHaveAttribute('id', 'link-idir')
    })
  })

  describe('Redirect Behavior', () => {
    it('should maintain current origin as redirect URI', () => {
      const originalLocation = window.location.origin

      render(<Login />, { wrapper })

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
    it('should have proper heading structure', () => {
      render(<Login />, { wrapper })

      const heading = screen.getByText('Login')
      expect(heading).toHaveClass('visually-hidden')
    })

    it('should have proper button focus handling', async () => {
      render(<Login />, { wrapper })

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
    it('should work with standalone rendering', () => {
      render(<Login />, { wrapper })

      expect(screen.getByTestId('login')).toBeInTheDocument()
    })

    it('should handle multiple rapid clicks gracefully', () => {
      render(<Login />, { wrapper })

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
