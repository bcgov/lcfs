import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { ViewOrgTransaction } from '@/views/Transactions/ViewOrgTransaction'

// Mock all external dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: vi.fn(),
    useLocation: vi.fn()
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'txn:loadingText': 'Loading transaction...',
        'adminadjustment:actionMsgs.errorRetrieval': 'Error retrieving admin adjustment',
        'initiativeagreement:actionMsgs.errorRetrieval': 'Error retrieving initiative agreement'
      }
      return translations[key] || key
    }
  })
}))

vi.mock('@/hooks/useAdminAdjustment', () => ({
  useAdminAdjustment: vi.fn()
}))

vi.mock('@/hooks/useInitiativeAgreement', () => ({
  useInitiativeAgreement: vi.fn()
}))

vi.mock('@/views/Transactions/components', () => ({
  OrgTransactionDetails: vi.fn(({ transactionType, transactionData }) => (
    <div data-test="org-transaction-details">
      Details: {transactionType} - {JSON.stringify(transactionData)}
    </div>
  ))
}))

vi.mock('@/components/Loading', () => ({
  __esModule: true,
  default: vi.fn(({ message }) => (
    <div data-test="loading">{message}</div>
  ))
}))

vi.mock('@/components/BCAlert', () => ({
  FloatingAlert: React.forwardRef(() => (
    <div data-test="floating-alert">Alert</div>
  ))
}))

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: vi.fn(({ color, children }) => (
    <div data-test="bc-typography" data-color={color}>{children}</div>
  ))
}))

vi.mock('@/views/Transactions/constants', () => ({
  ADMIN_ADJUSTMENT: 'ADMIN_ADJUSTMENT',
  INITIATIVE_AGREEMENT: 'INITIATIVE_AGREEMENT'
}))

// Get the mocked functions after import
import { useParams, useLocation } from 'react-router-dom'
import { useAdminAdjustment } from '@/hooks/useAdminAdjustment'
import { useInitiativeAgreement } from '@/hooks/useInitiativeAgreement'
import { OrgTransactionDetails } from '@/views/Transactions/components'
import Loading from '@/components/Loading'
import BCTypography from '@/components/BCTypography'

describe('ViewOrgTransaction', () => {
  const mockAlertRef = {
    current: {
      triggerAlert: vi.fn()
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock useRef
    vi.spyOn(React, 'useRef').mockReturnValue(mockAlertRef)
    
    // Default mock implementations
    vi.mocked(useAdminAdjustment).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null
    })

    vi.mocked(useInitiativeAgreement).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null
    })

    // Mock window.location.pathname
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/test'
      },
      writable: true
    })
  })

  const renderComponent = (transactionId = '123', pathname = '/org-admin-adjustment/123') => {
    vi.mocked(useParams).mockReturnValue({ transactionId })
    vi.mocked(useLocation).mockReturnValue({ pathname })
    
    // Update window.location.pathname for the component's useEffect
    window.location.pathname = pathname
    
    return render(<ViewOrgTransaction />)
  }

  describe('Component Rendering', () => {
    it('renders without crashing with admin adjustment path', () => {
      renderComponent('123', '/org-admin-adjustment/123')
      expect(vi.mocked(useAdminAdjustment)).toHaveBeenCalled()
    })

    it('renders without crashing with initiative agreement path', () => {
      renderComponent('456', '/org-initiative-agreement/456')
      expect(vi.mocked(useInitiativeAgreement)).toHaveBeenCalled()
    })
  })

  describe('Loading States', () => {
    it('shows loading when admin adjustment is loading', () => {
      vi.mocked(useAdminAdjustment).mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
        error: null
      })

      renderComponent('123', '/org-admin-adjustment/123')

      expect(Loading).toHaveBeenCalledWith({ message: 'Loading transaction...' }, {})
      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    it('shows loading when initiative agreement is loading', () => {
      vi.mocked(useInitiativeAgreement).mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
        error: null
      })

      renderComponent('456', '/org-initiative-agreement/456')

      expect(Loading).toHaveBeenCalledWith({ message: 'Loading transaction...' }, {})
      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })
  })

  describe('Success States', () => {
    it('renders transaction details for admin adjustment', () => {
      const mockData = { id: 123, description: 'Test adjustment' }
      vi.mocked(useAdminAdjustment).mockReturnValue({
        data: mockData,
        isLoading: false,
        isError: false,
        error: null
      })

      renderComponent('123', '/org-admin-adjustment/123')

      expect(OrgTransactionDetails).toHaveBeenCalledWith({
        transactionType: 'ADMIN_ADJUSTMENT',
        transactionData: mockData
      }, {})
      expect(screen.getByTestId('org-transaction-details')).toBeInTheDocument()
    })

    it('renders transaction details for initiative agreement', () => {
      const mockData = { id: 456, description: 'Test agreement' }
      vi.mocked(useInitiativeAgreement).mockReturnValue({
        data: mockData,
        isLoading: false,
        isError: false,
        error: null
      })

      renderComponent('456', '/org-initiative-agreement/456')

      expect(OrgTransactionDetails).toHaveBeenCalledWith({
        transactionType: 'INITIATIVE_AGREEMENT',
        transactionData: mockData
      }, {})
      expect(screen.getByTestId('org-transaction-details')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('shows error UI elements when error occurs', () => {
      const mockError = { message: 'Network error' }
      
      vi.mocked(useAdminAdjustment).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: mockError
      })

      renderComponent('123', '/org-admin-adjustment/123')

      expect(screen.getByTestId('floating-alert')).toBeInTheDocument()
      expect(screen.getByTestId('bc-typography')).toBeInTheDocument()
    })

    it('handles null alertRef gracefully', () => {
      vi.spyOn(React, 'useRef').mockReturnValue({ current: null })
      
      const mockError = { message: 'Test error' }
      
      vi.mocked(useAdminAdjustment).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        error: mockError
      })

      expect(() => {
        renderComponent('123', '/org-admin-adjustment/123')
      }).not.toThrow()
    })
  })

  describe('Transaction Type Detection', () => {
    it('calls useAdminAdjustment for admin adjustment URL', () => {
      renderComponent('123', '/org-admin-adjustment/123')

      expect(vi.mocked(useAdminAdjustment)).toHaveBeenCalledWith('123', {
        enabled: true,
        retry: false,
        staleTime: 0,
        cacheTime: 0,
        keepPreviousData: false
      })
    })

    it('calls useInitiativeAgreement for initiative agreement URL', () => {
      renderComponent('456', '/org-initiative-agreement/456')

      expect(vi.mocked(useInitiativeAgreement)).toHaveBeenCalledWith('456', {
        enabled: true,
        retry: false,
        staleTime: 0,
        cacheTime: 0,
        keepPreviousData: false
      })
    })

    it('handles undefined transactionId', () => {
      vi.mocked(useParams).mockReturnValue({ transactionId: undefined })
      vi.mocked(useLocation).mockReturnValue({ pathname: '/org-admin-adjustment/' })
      window.location.pathname = '/org-admin-adjustment/'
      
      render(<ViewOrgTransaction />)

      expect(vi.mocked(useAdminAdjustment)).toHaveBeenCalledWith(undefined, {
        enabled: false,
        retry: false,
        staleTime: 0,
        cacheTime: 0,
        keepPreviousData: false
      })
    })
  })

  describe('Edge Cases', () => {
    it('returns empty content when no transaction data and not loading/error', () => {
      vi.mocked(useAdminAdjustment).mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
        error: null
      })

      const { container } = renderComponent('123', '/org-admin-adjustment/123')

      // Should render empty content when no data - React fragment renders as empty div
      expect(container.innerHTML).toBe('')
    })

    it('handles empty transaction data object', () => {
      vi.mocked(useAdminAdjustment).mockReturnValue({
        data: {},
        isLoading: false,
        isError: false,
        error: null
      })

      renderComponent('123', '/org-admin-adjustment/123')

      expect(OrgTransactionDetails).toHaveBeenCalledWith({
        transactionType: 'ADMIN_ADJUSTMENT',
        transactionData: {}
      }, {})
    })

    it('handles path without specific transaction type indicators', () => {
      // This tests the case where transactionType remains null
      const { container } = renderComponent('789', '/some-other-path/789')
      
      // Should use initiative agreement as default and enabled should be false
      expect(vi.mocked(useInitiativeAgreement)).toHaveBeenCalledWith('789', 
        expect.objectContaining({
          enabled: false
        })
      )
    })
  })

  describe('Hook Parameters', () => {
    it('passes correct parameters with enabled true when transactionId and type exist', () => {
      renderComponent('123', '/org-admin-adjustment/123')

      expect(vi.mocked(useAdminAdjustment)).toHaveBeenCalledWith('123', {
        enabled: true,
        retry: false,
        staleTime: 0,
        cacheTime: 0,
        keepPreviousData: false
      })
    })

    it('passes enabled false when transactionId is missing', () => {
      vi.mocked(useParams).mockReturnValue({ transactionId: undefined })
      vi.mocked(useLocation).mockReturnValue({ pathname: '/org-admin-adjustment/' })
      window.location.pathname = '/org-admin-adjustment/'
      
      render(<ViewOrgTransaction />)

      expect(vi.mocked(useAdminAdjustment)).toHaveBeenCalledWith(undefined, {
        enabled: false,
        retry: false,
        staleTime: 0,
        cacheTime: 0,
        keepPreviousData: false
      })
    })
  })
})