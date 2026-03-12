import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ErrorOverlay } from '../ErrorOverlay'
import { useTranslation } from 'react-i18next'
import { useAuthorization } from '@/contexts/AuthorizationContext'
import { router } from '@/routes'

// Mock BCButton to avoid theme/function errors in tests
vi.mock('@/components/BCButton', () => ({
  __esModule: true,
  default: ({ children, onClick, 'data-test': dataTest, ...props }) => (
    <button onClick={onClick} data-test={dataTest} {...props}>
      {children}
    </button>
  )
}))

// Mock BCTypography
vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: ({ children, variant, sx, ...props }) => (
    <div data-variant={variant} {...props}>{children}</div>
  )
}))

// Mock MUI components
vi.mock('@mui/material', () => ({
  Box: ({ children, onClick, sx, component, ...props }) => {
    const Component = component || 'div'
    return <Component onClick={onClick} {...props}>{children}</Component>
  },
  IconButton: ({ children, onClick, 'aria-label': ariaLabel, size, sx, ...props }) => (
    <button onClick={onClick} aria-label={ariaLabel} {...props}>
      {children}
    </button>
  )
}))

vi.mock('@mui/icons-material/Close', () => ({
  __esModule: true,
  default: () => <span>×</span>
}))

vi.mock('react-i18next')
vi.mock('@/contexts/AuthorizationContext')
vi.mock('@/routes', () => ({
  router: {
    subscribe: vi.fn()
  }
}))

describe('ErrorOverlay', () => {
  const mockT = vi.fn((key) => {
    const translations = {
      'internalServerError.title': 'Internal Server Error',
      'internalServerError.message': 'Sorry, something went wrong on our end.',
      'errorPage.genericMessage': 'An unexpected error occurred.',
      'errorPage.referenceNumberLabel': 'Reference number',
      'errorPage.referenceNumbersLabel': 'Reference numbers',
      'errorPage.referenceNumberHint': 'Please quote this number when contacting support.',
      'errorPage.contactSupport': 'For assistance, contact us at',
      'errorPage.closeAndContinue': 'Close',
      'unauthorized.email': 'lcfs@gov.bc.ca'
    }
    return translations[key] || key
  })

  const mockSetErrorStatus = vi.fn()
  const mockClearErrorRefs = vi.fn()
  const mockResetServerError = vi.fn()

  const defaultAuthContext = {
    errorStatus: null,
    errorRefs: [],
    setErrorStatus: mockSetErrorStatus,
    clearErrorRefs: mockClearErrorRefs,
    resetServerError: mockResetServerError
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useTranslation.mockReturnValue({ t: mockT })
    useAuthorization.mockReturnValue(defaultAuthContext)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when errorStatus is null', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: null
      })

      const { container } = render(<ErrorOverlay />)
      expect(container.firstChild).toBeNull()
    })

    it('should render overlay when errorStatus is 500', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: ['ref-123']
      })

      render(<ErrorOverlay />)
      expect(screen.getByText(/Error 500/i)).toBeInTheDocument()
      expect(screen.getByText('Internal Server Error')).toBeInTheDocument()
    })

    it('should render generic error message for unknown error codes', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 503,
        errorRefs: []
      })

      render(<ErrorOverlay />)
      expect(screen.getByText(/Error 503/i)).toBeInTheDocument()
      expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument()
    })

    it('should display error code in overline text', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500
      })

      render(<ErrorOverlay />)
      expect(screen.getByText(/Error 500/i)).toBeInTheDocument()
    })

    it('should display title when titleKey is available', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500
      })

      render(<ErrorOverlay />)
      expect(screen.getByText('Internal Server Error')).toBeInTheDocument()
    })

    it('should not display title when titleKey is null', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 503
      })

      render(<ErrorOverlay />)
      expect(screen.queryByRole('heading', { level: 6 })).not.toBeInTheDocument()
    })
  })

  describe('Reference Numbers', () => {
    it('should not display reference number section when errorRefs is empty', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: []
      })

      render(<ErrorOverlay />)
      expect(screen.queryByText('Reference number')).not.toBeInTheDocument()
    })

    it('should display single reference number', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: ['abc-123-def-456']
      })

      render(<ErrorOverlay />)
      expect(screen.getByText('Reference number')).toBeInTheDocument()
      expect(screen.getByText('abc-123-def-456')).toBeInTheDocument()
      expect(screen.getByText('Please quote this number when contacting support.')).toBeInTheDocument()
    })

    it('should display multiple reference numbers with numbering', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: ['ref-001', 'ref-002', 'ref-003']
      })

      render(<ErrorOverlay />)
      expect(screen.getByText('Reference numbers')).toBeInTheDocument()
      expect(screen.getByText(/1\. ref-001/)).toBeInTheDocument()
      expect(screen.getByText(/2\. ref-002/)).toBeInTheDocument()
      expect(screen.getByText(/3\. ref-003/)).toBeInTheDocument()
    })

    it('should use singular label for single reference', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: ['single-ref']
      })

      render(<ErrorOverlay />)
      expect(screen.getByText('Reference number')).toBeInTheDocument()
      expect(screen.queryByText('Reference numbers')).not.toBeInTheDocument()
    })

    it('should use plural label for multiple references', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: ['ref-1', 'ref-2']
      })

      render(<ErrorOverlay />)
      expect(screen.getByText('Reference numbers')).toBeInTheDocument()
      expect(screen.queryByText('Reference number')).not.toBeInTheDocument()
    })
  })

  describe('Contact Support', () => {
    it('should display contact support message with email link', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500
      })

      render(<ErrorOverlay />)
      expect(screen.getByText(/For assistance, contact us at/i)).toBeInTheDocument()
      
      const emailLink = screen.getByRole('link', { name: 'lcfs@gov.bc.ca' })
      expect(emailLink).toBeInTheDocument()
      expect(emailLink).toHaveAttribute('href', 'mailto:lcfs@gov.bc.ca')
    })
  })

  describe('Close Button', () => {
    it('should render close button with correct text', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500
      })

      render(<ErrorOverlay />)
      const closeButton = screen.getByTestId('error-overlay-close-btn')
      expect(closeButton).toBeInTheDocument()
      expect(closeButton).toHaveTextContent('Close')
    })

    it('should call setErrorStatus and clearErrorRefs when close button is clicked', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: ['ref-123']
      })

      render(<ErrorOverlay />)
      const closeButton = screen.getByTestId('error-overlay-close-btn')
      
      fireEvent.click(closeButton)

      expect(mockSetErrorStatus).toHaveBeenCalledWith(null)
      expect(mockClearErrorRefs).toHaveBeenCalled()
    })

    it('should render IconButton close in top right corner', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500
      })

      render(<ErrorOverlay />)
      const iconButton = screen.getByLabelText('close')
      expect(iconButton).toBeInTheDocument()
    })

    it('should call setErrorStatus and clearErrorRefs when icon close is clicked', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: ['ref-456']
      })

      render(<ErrorOverlay />)
      const iconButton = screen.getByLabelText('close')
      
      fireEvent.click(iconButton)

      expect(mockSetErrorStatus).toHaveBeenCalledWith(null)
      expect(mockClearErrorRefs).toHaveBeenCalled()
    })
  })

  describe('Backdrop Click', () => {
    it('should close overlay when backdrop is clicked', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500
      })

      const { container } = render(<ErrorOverlay />)
      const backdrop = container.firstChild
      
      fireEvent.click(backdrop)

      expect(mockSetErrorStatus).toHaveBeenCalledWith(null)
      expect(mockClearErrorRefs).toHaveBeenCalled()
    })

    it('should not close overlay when modal content is clicked', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500
      })

      render(<ErrorOverlay />)
      const modalContent = screen.getByText('Internal Server Error').closest('div')
      
      fireEvent.click(modalContent)

      expect(mockSetErrorStatus).not.toHaveBeenCalled()
      expect(mockClearErrorRefs).not.toHaveBeenCalled()
    })
  })

  describe('Router Subscription', () => {
    it('should subscribe to router on mount', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500
      })

      render(<ErrorOverlay />)

      expect(router.subscribe).toHaveBeenCalledWith(mockResetServerError)
    })

    it('should pass resetServerError to router subscription', () => {
      const customResetFn = vi.fn()
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        resetServerError: customResetFn
      })

      render(<ErrorOverlay />)

      expect(router.subscribe).toHaveBeenCalledWith(customResetFn)
    })
  })

  describe('Error Content Configuration', () => {
    it('should use ERROR_CONTENT mapping for 500 errors', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500
      })

      render(<ErrorOverlay />)
      
      expect(screen.getByText(/Error 500/i)).toBeInTheDocument()
      expect(mockT).toHaveBeenCalledWith('internalServerError.title')
      expect(mockT).toHaveBeenCalledWith('internalServerError.message')
    })

    it('should fallback to generic message for unmapped error codes', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 502
      })

      render(<ErrorOverlay />)
      
      expect(screen.getByText(/Error 502/i)).toBeInTheDocument()
      expect(mockT).toHaveBeenCalledWith('errorPage.genericMessage')
    })
  })

  describe('Styling and Layout', () => {
    it('should render overlay with proper structure', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500
      })

      const { container } = render(<ErrorOverlay />)
      const overlay = container.firstChild
      
      expect(overlay).toBeInTheDocument()
      expect(overlay.tagName).toBe('DIV')
    })

    it('should render modal content within overlay', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500
      })

      render(<ErrorOverlay />)
      const modalContent = screen.getByText('Internal Server Error')
      
      expect(modalContent).toBeInTheDocument()
      expect(modalContent.closest('div')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible close button with aria-label', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500
      })

      render(<ErrorOverlay />)
      const iconButton = screen.getByLabelText('close')
      expect(iconButton).toHaveAttribute('aria-label', 'close')
    })

    it('should render reference numbers in code elements for screen readers', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: ['ref-abc-123']
      })

      render(<ErrorOverlay />)
      const codeElement = screen.getByText('ref-abc-123')
      expect(codeElement.tagName).toBe('CODE')
    })
  })

  describe('Edge Cases', () => {
    it('should handle errorStatus of 0', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 0
      })

      const { container } = render(<ErrorOverlay />)
      // errorStatus of 0 is falsy, so component should not render
      expect(container.firstChild).toBeNull()
    })

    it('should handle very long reference numbers', () => {
      const longRef = 'a'.repeat(100)
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: [longRef]
      })

      render(<ErrorOverlay />)
      expect(screen.getByText(longRef)).toBeInTheDocument()
    })

    it('should handle many reference numbers', () => {
      const manyRefs = Array.from({ length: 10 }, (_, i) => `ref-${i}`)
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: manyRefs
      })

      render(<ErrorOverlay />)
      manyRefs.forEach((ref, index) => {
        expect(screen.getByText(new RegExp(`${index + 1}\\. ${ref}`))).toBeInTheDocument()
      })
    })

    it('should handle special characters in reference numbers', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: ['ref-123!@#$%^&*()']
      })

      render(<ErrorOverlay />)
      expect(screen.getByText('ref-123!@#$%^&*()')).toBeInTheDocument()
    })
  })

  describe('Integration', () => {
    it('should handle complete error flow with reference number', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: ['correlation-id-xyz-789']
      })

      render(<ErrorOverlay />)

      expect(screen.getByText(/Error 500/i)).toBeInTheDocument()
      expect(screen.getByText('Internal Server Error')).toBeInTheDocument()
      expect(screen.getByText('Sorry, something went wrong on our end.')).toBeInTheDocument()
      expect(screen.getByText('Reference number')).toBeInTheDocument()
      expect(screen.getByText('correlation-id-xyz-789')).toBeInTheDocument()
      expect(screen.getByText('Please quote this number when contacting support.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'lcfs@gov.bc.ca' })).toBeInTheDocument()
      expect(screen.getByTestId('error-overlay-close-btn')).toBeInTheDocument()
    })

    it('should handle error without reference number', () => {
      useAuthorization.mockReturnValue({
        ...defaultAuthContext,
        errorStatus: 500,
        errorRefs: []
      })

      render(<ErrorOverlay />)

      expect(screen.getByText(/Error 500/i)).toBeInTheDocument()
      expect(screen.getByText('Internal Server Error')).toBeInTheDocument()
      expect(screen.queryByText('Reference number')).not.toBeInTheDocument()
      expect(screen.getByTestId('error-overlay-close-btn')).toBeInTheDocument()
    })
  })
})
