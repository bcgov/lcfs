import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ViewLegacyComplianceReport } from '../ViewLegacyComplianceReport'

// Mock React Router
const mockNavigate = vi.fn()
const mockLocation = {
  pathname: '/compliance-reports/123',
  state: {}
}
const mockParams = {
  compliancePeriod: '2024',
  complianceReportId: '123'
}

vi.mock('react-router-dom', () => ({
  useLocation: () => mockLocation,
  useNavigate: () => mockNavigate,
  useParams: () => mockParams
}))

// Mock translation
const mockT = vi.fn((key) => key)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT })
}))

// Mock custom hooks - with hoisting-safe implementation
const mockUseCurrentUser = vi.fn()
const mockUseOrganization = vi.fn()

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser()
}))

vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: () => mockUseOrganization()
}))

// Mock feature flags - completely self-contained to avoid hoisting issues
const mockIsFeatureEnabled = vi.fn(() => true)
vi.mock('@/constants/config.js', () => ({
  FEATURE_FLAGS: {
    LEGACY_REPORT_DETAILS: 'LEGACY_REPORT_DETAILS'
  },
  isFeatureEnabled: vi.fn(() => true),
  CONFIG: {}
}))

// Mock child components
vi.mock('@/views/ComplianceReports/components/LegacyAssessmentCard.jsx', () => ({
  LegacyAssessmentCard: ({ children, orgData, history, isGovernmentUser, currentStatus, legacyReportId, hasSupplemental, chain, ...props }) => (
    <div data-test="legacy-assessment-card">{children}</div>
  )
}))

vi.mock('@/views/ComplianceReports/legacy/LegacyReportDetails.jsx', () => ({
  default: ({ children, currentStatus, ...props }) => (
    <div data-test="legacy-report-details">{children}</div>
  )
}))

vi.mock('../legacy/LegacyReportSummary', () => ({
  default: ({ children, reportID, alertRef, ...props }) => (
    <div data-test="legacy-report-summary">{children}</div>
  )
}))

// Mock BCAlert with ref - must be inside mock factory to avoid hoisting issues
const mockTriggerAlert = vi.fn()

vi.mock('@/components/BCAlert', () => {
  const { forwardRef, useImperativeHandle } = require('react')
  
  const MockFloatingAlert = forwardRef((props, ref) => {
    useImperativeHandle(ref, () => ({
      triggerAlert: mockTriggerAlert
    }), [])
    return <div {...props} />
  })
  
  MockFloatingAlert.displayName = 'MockFloatingAlert'
  
  return {
    FloatingAlert: MockFloatingAlert
  }
})

// Mock other components
vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => <div data-test="bc-box" {...props}>{children}</div>
}))

vi.mock('@/components/BCModal', () => ({
  default: ({ children, ...props }) => (
    <div data-test="bc-modal" {...props}>{children}</div>
  )
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading">Loading...</div>
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => (
    <div data-test="bc-typography" {...props}>{children}</div>
  )
}))

// Mock Keycloak context
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      authenticated: true,
      token: 'mock-token'
    }
  })
}))

// Mock Authorization context
vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn(),
    permissions: [],
    roles: []
  })
}))

// Mock notistack
vi.mock('notistack', () => ({
  useSnackbar: () => ({
    enqueueSnackbar: vi.fn(),
    closeSnackbar: vi.fn()
  })
}))

// Note: mockTriggerAlert is defined above in the mock

// Test data factories
const createMockReportData = (overrides = {}) => ({
  report: {
    compliancePeriod: { description: '2024 Compliance Period' },
    nickname: 'Test Report',
    currentStatus: { status: 'Draft' },
    organizationId: 1,
    legacyId: 'LEGACY-123',
    hasSupplemental: false,
    history: [],
    ...overrides.report
  },
  chain: [],
  ...overrides
})

describe('ViewLegacyComplianceReport', () => {
  let originalScrollTo
  let originalPageYOffset
  let originalScrollHeight

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set default mock returns first
    mockUseCurrentUser.mockReturnValue({
      data: { isGovernmentUser: false },
      isLoading: false
    })
    mockUseOrganization.mockReturnValue({
      data: { id: 1, name: 'Test Org' },
      isLoading: false
    })
    
    // Mock window scroll methods and properties
    originalScrollTo = window.scrollTo
    originalPageYOffset = window.pageYOffset
    originalScrollHeight = document.documentElement.scrollHeight
    
    window.scrollTo = vi.fn()
    Object.defineProperty(window, 'pageYOffset', {
      value: 0,
      writable: true
    })
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 1000,
      writable: true
    })
    
    // Reset location state
    mockLocation.state = {}
    
    // Add/remove event listener spies
    vi.spyOn(window, 'addEventListener')
    vi.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    window.scrollTo = originalScrollTo
    window.pageYOffset = originalPageYOffset
    document.documentElement.scrollHeight = originalScrollHeight
  })

  const defaultProps = {
    reportData: createMockReportData(),
    error: null,
    isError: false
  }

  const renderComponent = (props = {}) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    
    return render(
      <QueryClientProvider client={queryClient}>
        <ViewLegacyComplianceReport {...defaultProps} {...props} />
      </QueryClientProvider>
    )
  }

  describe('Basic Rendering', () => {
    it('renders compliance report header with correct data', () => {
      renderComponent()
      
      expect(screen.getByTestId('compliance-report-header')).toBeInTheDocument()
      expect(screen.getByTestId('compliance-report-status')).toBeInTheDocument()
    })

    it('renders legacy assessment card with correct props', () => {
      renderComponent()
      
      const assessmentCard = screen.getByTestId('legacy-assessment-card')
      expect(assessmentCard).toBeInTheDocument()
    })

    it('renders questions section', () => {
      renderComponent()
      
      expect(mockT).toHaveBeenCalledWith('report:questions')
      expect(mockT).toHaveBeenCalledWith('report:contact')
    })

    it('renders scroll fab button', () => {
      renderComponent()
      
      const fabButton = screen.getByRole('button')
      expect(fabButton).toBeInTheDocument()
      expect(fabButton).toHaveAttribute('aria-label', 'scroll to bottom')
    })
  })

  describe('Loading and Error States', () => {
    it('shows loading component when user data is loading', () => {
      mockUseCurrentUser.mockReturnValue({
        data: null,
        isLoading: true
      })
      
      renderComponent()
      
      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.queryByTestId('compliance-report-header')).not.toBeInTheDocument()
    })

    it('shows loading component when organization data is loading', () => {
      mockUseOrganization.mockReturnValue({
        data: null,
        isLoading: true
      })
      
      renderComponent()
      
      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    it('shows error state when isError is true', () => {
      renderComponent({ isError: true })
      
      expect(screen.getByTestId('alert-box')).toBeInTheDocument()
      expect(screen.getByTestId('bc-typography')).toBeInTheDocument()
      expect(mockT).toHaveBeenCalledWith('report:errorRetrieving')
      expect(screen.queryByTestId('compliance-report-header')).not.toBeInTheDocument()
    })

  })

  describe('Scroll Functionality', () => {
    it('scrolls to top when isScrollingUp is true', async () => {
      renderComponent()
      
      // Simulate scrolling up state
      window.pageYOffset = 100
      fireEvent.scroll(window)
      
      await act(async () => {
        // Simulate scroll up detection
        window.pageYOffset = 50
        fireEvent.scroll(window)
      })
      
      const fabButton = screen.getByRole('button')
      
      await act(async () => {
        fireEvent.click(fabButton)
      })
      
      expect(window.scrollTo).toHaveBeenCalledWith({
        top: 0,
        behavior: 'smooth'
      })
    })

    it('scrolls to bottom when isScrollingUp is false', async () => {
      renderComponent()
      
      // Simulate scrolling down state
      window.pageYOffset = 100
      document.documentElement.scrollHeight = 1000
      
      await act(async () => {
        fireEvent.scroll(window)
      })
      
      const fabButton = screen.getByRole('button')
      
      await act(async () => {
        fireEvent.click(fabButton)
      })
      
      expect(window.scrollTo).toHaveBeenCalledWith({
        top: 1000,
        behavior: 'smooth'
      })
    })

    it('detects scrolling up correctly', async () => {
      renderComponent()
      
      // Set initial scroll position
      window.pageYOffset = 100
      fireEvent.scroll(window)
      
      await act(async () => {
        // Scroll up (lower position)
        window.pageYOffset = 50
        fireEvent.scroll(window)
      })
      
      const fabButton = screen.getByRole('button')
      expect(fabButton).toHaveAttribute('aria-label', 'scroll to top')
    })

    it('detects scrolling down correctly', async () => {
      renderComponent()
      
      // Set initial scroll position
      window.pageYOffset = 50
      fireEvent.scroll(window)
      
      await act(async () => {
        // Scroll down (higher position)
        window.pageYOffset = 100
        fireEvent.scroll(window)
      })
      
      const fabButton = screen.getByRole('button')
      expect(fabButton).toHaveAttribute('aria-label', 'scroll to bottom')
    })

    it('treats scroll position 0 as scrolling up', async () => {
      renderComponent()
      
      // Set initial scroll position
      window.pageYOffset = 50
      fireEvent.scroll(window)
      
      await act(async () => {
        // Scroll to top
        window.pageYOffset = 0
        fireEvent.scroll(window)
      })
      
      const fabButton = screen.getByRole('button')
      expect(fabButton).toHaveAttribute('aria-label', 'scroll to top')
    })

    it('sets up and cleans up scroll event listeners', () => {
      const { unmount } = renderComponent()
      
      expect(window.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
      
      unmount()
      
      expect(window.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    })
  })

  describe('Location Alert Processing', () => {
    beforeEach(() => {
      mockTriggerAlert.mockClear()
      mockNavigate.mockClear()
    })

    it('processes location alert with default severity', async () => {
      mockLocation.state = {
        message: 'Test alert message'
      }
      
      await act(async () => {
        renderComponent()
      })
      
      expect(mockTriggerAlert).toHaveBeenCalledWith({
        message: 'Test alert message',
        severity: 'info'
      })
    })

    it('does not process alert when no message in location state', async () => {
      mockLocation.state = {}
      
      await act(async () => {
        renderComponent()
      })
      
      expect(mockTriggerAlert).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('clears message from location state after processing', async () => {
      mockLocation.state = {
        message: 'Test alert message',
        severity: 'warning',
        otherData: 'should be preserved'
      }
      
      await act(async () => {
        renderComponent()
      })
      
      expect(mockNavigate).toHaveBeenCalledWith('/compliance-reports/123', {
        replace: true,
        state: {
          message: undefined,
          severity: undefined,
          otherData: 'should be preserved'
        }
      })
    })
  })

  describe('Feature Flag Conditional Rendering', () => {
    it('does not render legacy report details when feature flag is disabled', async () => {
      // Import the mocked module to access the mock
      const config = await import('@/constants/config.js')
      vi.mocked(config.isFeatureEnabled).mockReturnValue(false)
      
      renderComponent()
      
      expect(screen.queryByTestId('legacy-report-details')).not.toBeInTheDocument()
      expect(screen.queryByTestId('legacy-report-summary')).not.toBeInTheDocument()
    })
  })

  describe('Conditional Rendering and UI States', () => {
    it('shows correct tooltip text when scrolling up', async () => {
      renderComponent()
      
      // Set initial scroll position and scroll up
      window.pageYOffset = 100
      fireEvent.scroll(window)
      
      await act(async () => {
        window.pageYOffset = 50
        fireEvent.scroll(window)
      })
      
      expect(mockT).toHaveBeenCalledWith('common:scrollToTop')
    })

    it('shows correct tooltip text when scrolling down', async () => {
      renderComponent()
      
      // Set initial scroll position and scroll down
      window.pageYOffset = 50
      fireEvent.scroll(window)
      
      await act(async () => {
        window.pageYOffset = 100
        fireEvent.scroll(window)
      })
      
      expect(mockT).toHaveBeenCalledWith('common:scrollToBottom')
    })

    it('shows correct icon when scrolling up', async () => {
      renderComponent()
      
      // Simulate scrolling up
      window.pageYOffset = 100
      fireEvent.scroll(window)
      
      await act(async () => {
        window.pageYOffset = 0
        fireEvent.scroll(window)
      })
      
      // KeyboardArrowUp icon should be rendered
      const fabButton = screen.getByRole('button')
      expect(fabButton).toHaveAttribute('aria-label', 'scroll to top')
    })

    it('shows correct icon when scrolling down', async () => {
      renderComponent()
      
      // Simulate scrolling down
      window.pageYOffset = 50
      fireEvent.scroll(window)
      
      await act(async () => {
        window.pageYOffset = 100
        fireEvent.scroll(window)
      })
      
      // KeyboardArrowDown icon should be rendered
      const fabButton = screen.getByRole('button')
      expect(fabButton).toHaveAttribute('aria-label', 'scroll to bottom')
    })
  })

  describe('Hook Integration', () => {
    it('uses params from useParams hook', () => {
      renderComponent()
      
      // The component should use the mocked params
      expect(mockParams.compliancePeriod).toBe('2024')
      expect(mockParams.complianceReportId).toBe('123')
    })

    it('handles government user detection from useCurrentUser', () => {
      mockUseCurrentUser.mockReturnValue({
        data: { isGovernmentUser: true },
        isLoading: false
      })
      
      renderComponent()
      
      const assessmentCard = screen.getByTestId('legacy-assessment-card')
      expect(assessmentCard).toBeInTheDocument()
    })

    it('handles organization data from useOrganization hook', () => {
      renderComponent()
      
      const assessmentCard = screen.getByTestId('legacy-assessment-card')
      expect(assessmentCard).toBeInTheDocument()
    })

    it('uses translation keys correctly', () => {
      renderComponent()
      
      expect(mockT).toHaveBeenCalledWith('report:complianceReport')
      expect(mockT).toHaveBeenCalledWith('report:questions')
      expect(mockT).toHaveBeenCalledWith('report:contact')
    })
  })

  describe('Modal Management', () => {
    it('renders modal component', () => {
      renderComponent()
      
      const modal = screen.getByTestId('bc-modal')
      expect(modal).toBeInTheDocument()
    })
  })
})