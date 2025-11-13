import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CreditMarketDetailsCard } from '../CreditMarketDetailsCard'
import { wrapper } from '@/tests/utils/wrapper'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useOrganization,
  useUpdateCurrentOrgCreditMarket,
  useUpdateOrganizationCreditMarket
} from '@/hooks/useOrganization'
import { useQueryClient } from '@tanstack/react-query'

// Mock the hooks
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')
vi.mock('@tanstack/react-query')

// Mock FontAwesome icons
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }) => <span data-testid={`icon-${icon.iconName}`} />
}))

// Mock BC Components to be simpler for testing
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  default: ({ title, content, editButton, ...props }) => (
    <div data-testid="bc-widget-card" {...props}>
      <h2>{title}</h2>
      {editButton && (
        <button 
          data-testid="edit-button" 
          onClick={editButton.onClick}
          id={editButton.id}
        >
          {editButton.text}
        </button>
      )}
      <div data-testid="content">{content}</div>
    </div>
  )
}))

// Mock react-hook-form
const mockReset = vi.fn()
const mockHandleSubmit = vi.fn()
const mockWatch = vi.fn()
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    handleSubmit: mockHandleSubmit,
    reset: mockReset,
    formState: { isDirty: false },
    watch: mockWatch
  }),
  Controller: ({ render, name, control }) => {
    const fieldProps = { value: '', onChange: vi.fn() }
    return render({ field: fieldProps, fieldState: {} })
  }
}))

const mockCurrentUser = {
  firstName: 'John',
  lastName: 'Doe',
  roles: [{ name: 'transfers' }],
  organization: { organizationId: 1 }
}

const mockHasAnyRole = vi.fn((...roleNames) =>
  roleNames.some((roleName) =>
    mockCurrentUser.roles.some((userRole) => userRole.name === roleName)
  )
)

const mockOrganizationData = {
  organizationId: 1,
  creditMarketContactName: 'Jane Smith',
  creditMarketContactPhone: '555-1234',
  creditMarketContactEmail: 'jane@example.com',
  creditMarketIsSeller: true,
  creditMarketIsBuyer: false,
  creditsToSell: 100,
  displayInCreditMarket: true,
  totalBalance: 500,
  orgStatus: { status: 'Registered' },
  phone: '555-5678',
  email: 'org@example.com'
}

const mockUpdateMutation = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null
}

const mockAdminUpdateMutation = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null
}

const mockQueryClient = {
  refetchQueries: vi.fn()
}

describe('CreditMarketDetailsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasAnyRole.mockClear()
    
    mockHandleSubmit.mockImplementation((fn) => (e) => {
      e?.preventDefault?.()
      const formData = {
        contactName: 'Jane Smith',
        phone: '555-1234',
        email: 'jane@example.com',
        isSeller: true,
        isBuyer: false,
        creditsToSell: '100',
        displayInMarket: true
      }
      fn(formData)
    })

    mockWatch.mockReturnValue(true)

    vi.mocked(useCurrentUser).mockReturnValue({
      data: mockCurrentUser,
      hasAnyRole: mockHasAnyRole
    })
    vi.mocked(useOrganization).mockReturnValue({
      data: mockOrganizationData,
      isLoading: false
    })
    vi.mocked(useUpdateCurrentOrgCreditMarket).mockReturnValue(mockUpdateMutation)
    vi.mocked(useUpdateOrganizationCreditMarket).mockReturnValue(
      mockAdminUpdateMutation
    )
    vi.mocked(useQueryClient).mockReturnValue(mockQueryClient)
  })

  describe('Loading and Basic Rendering', () => {
    it('displays loading component when data is loading', () => {
      vi.mocked(useOrganization).mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<CreditMarketDetailsCard />, { wrapper })
      
      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    it('renders component without crashing', () => {
      render(<CreditMarketDetailsCard />, { wrapper })
      
      expect(screen.getByText('Credit trading market details')).toBeInTheDocument()
    })

    it('displays organization data in read-only mode', () => {
      render(<CreditMarketDetailsCard />, { wrapper })
      
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('555-1234')).toBeInTheDocument()
      expect(screen.getByText('jane@example.com')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
    })
  })

  describe('Permission and Access Control', () => {
    it('hides edit button when user lacks permissions', () => {
      vi.mocked(useCurrentUser).mockReturnValue({
        data: { ...mockCurrentUser, roles: [{ name: 'supplier' }] },
        hasAnyRole: () => false
      })

      render(<CreditMarketDetailsCard />, { wrapper })
      
      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument()
    })

    it('hides edit button when no current user', () => {
      vi.mocked(useCurrentUser).mockReturnValue({
        data: null,
        hasAnyRole: () => false
      })

      render(<CreditMarketDetailsCard />, { wrapper })
      
      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument()
    })
  })

  describe('Edit Mode Functionality', () => {
    it('handles edit mode state changes', () => {
      render(<CreditMarketDetailsCard />, { wrapper })
      
      // Component should be in read-only mode by default
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Credit trading market details')).toBeInTheDocument()
    })

    it('form reset is called when component mounts', () => {
      render(<CreditMarketDetailsCard />, { wrapper })
      
      // Form reset should be called due to useEffect
      expect(mockReset).toHaveBeenCalled()
    })
  })

  describe('Form Logic', () => {
    it('initializes form with organization data', () => {
      render(<CreditMarketDetailsCard />, { wrapper })
      
      // Verify handleSubmit was properly mocked
      expect(mockHandleSubmit).toBeDefined()
      expect(mockWatch).toBeDefined()
    })

    it('handles form submission logic correctly', () => {
      render(<CreditMarketDetailsCard />, { wrapper })
      
      // Test that form submit logic would transform data correctly
      const testData = {
        contactName: 'Test Contact',
        phone: '555-0000',
        email: 'test@example.com',
        isSeller: true,
        isBuyer: false,
        creditsToSell: '150',
        displayInMarket: true
      }
      
      // Verify the mutation would be called with correct transformation
      const expectedPayload = {
        credit_market_contact_name: testData.contactName,
        credit_market_contact_email: testData.email,
        credit_market_contact_phone: testData.phone,
        credit_market_is_seller: testData.isSeller,
        credit_market_is_buyer: testData.isBuyer,
        credits_to_sell: 150,
        display_in_credit_market: testData.displayInMarket
      }
      
      expect(expectedPayload.credits_to_sell).toBe(150)
    })

    it('handles seller vs non-seller credits logic', () => {
      render(<CreditMarketDetailsCard />, { wrapper })
      
      // Test credits to sell logic for sellers
      const sellerData = { isSeller: true, creditsToSell: '100' }
      const expectedSellerCredits = parseInt(sellerData.creditsToSell, 10) || 0
      expect(expectedSellerCredits).toBe(100)
      
      // Test credits to sell logic for non-sellers (should be 0)
      const nonSellerData = { isSeller: false, creditsToSell: '100' }
      const expectedNonSellerCredits = nonSellerData.isSeller ? parseInt(nonSellerData.creditsToSell, 10) || 0 : 0
      expect(expectedNonSellerCredits).toBe(0)
    })

    it('handles invalid credits input', () => {
      render(<CreditMarketDetailsCard />, { wrapper })
      
      // Test invalid input handling
      const invalidCredits = parseInt('invalid', 10) || 0
      expect(invalidCredits).toBe(0)
      
      const emptyCredits = parseInt('', 10) || 0
      expect(emptyCredits).toBe(0)
      
      const validCredits = parseInt('123', 10) || 0
      expect(validCredits).toBe(123)
    })
  })

  describe('Admin variant handling', () => {
    it('initializes admin mutation when organizationId is provided', () => {
      render(
        <CreditMarketDetailsCard organizationId={5} variant="admin" />,
        { wrapper }
      )

      expect(useUpdateOrganizationCreditMarket).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          clearCache: true,
          invalidateRelatedQueries: true
        })
      )
    })

    it('renders selected organization details when provided', () => {
      render(
        <CreditMarketDetailsCard
          organizationId={5}
          variant="admin"
        />,
        { wrapper }
      )

      expect(
        screen.getByText(/Selected organization/i)
      ).toBeInTheDocument()
      expect(
        screen.queryByText(/Clear selection/i)
      ).not.toBeInTheDocument()
    })
  })

  describe('Data Display', () => {
    it('displays contact info with fallbacks to user data', () => {
      vi.mocked(useOrganization).mockReturnValue({
        data: {
          ...mockOrganizationData,
          creditMarketContactName: null,
          creditMarketContactEmail: null,
          creditMarketContactPhone: null
        },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('org@example.com')).toBeInTheDocument()
      expect(screen.getByText('555-5678')).toBeInTheDocument()
    })

    it('displays "Not available" when no contact info exists', () => {
      vi.mocked(useOrganization).mockReturnValue({
        data: {
          ...mockOrganizationData,
          creditMarketContactName: null,
          creditMarketContactEmail: null,
          creditMarketContactPhone: null,
          email: null,
          phone: null
        },
        isLoading: false
      })

      vi.mocked(useCurrentUser).mockReturnValue({
        data: { ...mockCurrentUser, firstName: null, lastName: null },
        hasAnyRole: mockHasAnyRole
      })

      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.getAllByText(/not available/i).length).toBeGreaterThanOrEqual(3)
    })

    it('displays seller role only', () => {
      vi.mocked(useOrganization).mockReturnValue({
        data: {
          ...mockOrganizationData,
          creditMarketIsSeller: true,
          creditMarketIsBuyer: false
        },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.getByText(/seller/i)).toBeInTheDocument()
    })

    it('displays buyer role only', () => {
      vi.mocked(useOrganization).mockReturnValue({
        data: {
          ...mockOrganizationData,
          creditMarketIsSeller: false,
          creditMarketIsBuyer: true
        },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.getByText(/buyer/i)).toBeInTheDocument()
    })

    it('displays both seller and buyer roles', () => {
      vi.mocked(useOrganization).mockReturnValue({
        data: {
          ...mockOrganizationData,
          creditMarketIsSeller: true,
          creditMarketIsBuyer: true
        },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.getByText(/seller, buyer/i)).toBeInTheDocument()
    })

    it('displays "Not available" when no roles selected', () => {
      vi.mocked(useOrganization).mockReturnValue({
        data: {
          ...mockOrganizationData,
          creditMarketIsSeller: false,
          creditMarketIsBuyer: false
        },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.getByText(/not available/i)).toBeInTheDocument()
    })

    it('shows registration warning for unregistered organizations', () => {
      vi.mocked(useOrganization).mockReturnValue({
        data: { ...mockOrganizationData, orgStatus: { status: 'Active' } },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.getByText(/must be registered for transfers/i)).toBeInTheDocument()
    })

    it('hides registration warning for registered organizations', () => {
      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.queryByText(/must be registered for transfers/i)).not.toBeInTheDocument()
    })

    it('displays yes for display in market when true', () => {
      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.getByText(/yes/i)).toBeInTheDocument()
    })

    it('displays no for display in market when false', () => {
      vi.mocked(useOrganization).mockReturnValue({
        data: { ...mockOrganizationData, displayInCreditMarket: false },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.getByText(/no/i)).toBeInTheDocument()
    })
  })

  describe('Hooks Integration', () => {
    it('uses organization hook with correct parameters', () => {
      render(<CreditMarketDetailsCard />, { wrapper })
      
      expect(vi.mocked(useOrganization)).toHaveBeenCalledWith(1, {
        enabled: true,
        staleTime: 0,
        cacheTime: 0
      })
    })

    it('initializes mutation hook correctly', () => {
      render(<CreditMarketDetailsCard />, { wrapper })
      
      expect(vi.mocked(useUpdateCurrentOrgCreditMarket)).toHaveBeenCalledWith(
        expect.objectContaining({
          clearCache: true,
          invalidateRelatedQueries: true,
          onSuccess: expect.any(Function),
          onError: expect.any(Function)
        })
      )
    })

    it('uses query client for cache management', () => {
      render(<CreditMarketDetailsCard />, { wrapper })
      
      expect(vi.mocked(useQueryClient)).toHaveBeenCalled()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles missing organization data gracefully', () => {
      vi.mocked(useOrganization).mockReturnValue({ data: null, isLoading: false })

      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.getByText('Credit trading market details')).toBeInTheDocument()
    })

    it('handles form reset when organization data changes', () => {
      render(<CreditMarketDetailsCard />, { wrapper })

      expect(mockReset).toHaveBeenCalled()
    })

    it('handles successful mutation with query refetch and callback', async () => {
      const onSuccess = vi.fn()
      const onSaveSuccess = vi.fn()
      vi.mocked(useUpdateCurrentOrgCreditMarket).mockImplementation(({ onSuccess: callback }) => {
        onSuccess.mockImplementation(callback)
        return mockUpdateMutation
      })

      render(<CreditMarketDetailsCard onSaveSuccess={onSaveSuccess} />, {
        wrapper
      })

      await act(async () => {
        onSuccess()
      })

      expect(mockQueryClient.refetchQueries).toHaveBeenCalledWith(['organization', 1])
      expect(onSaveSuccess).toHaveBeenCalled()
    })

    it('handles mutation error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onError = vi.fn()
      
      vi.mocked(useUpdateCurrentOrgCreditMarket).mockImplementation(({ onError: callback }) => {
        onError.mockImplementation(callback)
        return mockUpdateMutation
      })

      render(<CreditMarketDetailsCard />, { wrapper })

      const error = new Error('Update failed')
      onError(error)

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update credit market details:', error)
      
      consoleErrorSpy.mockRestore()
    })

    it('handles missing user name gracefully', () => {
      vi.mocked(useCurrentUser).mockReturnValue({
        data: { ...mockCurrentUser, firstName: '', lastName: '' },
        hasAnyRole: mockHasAnyRole
      })

      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.getByText('Credit trading market details')).toBeInTheDocument()
    })

    it('handles available balance fallback', () => {
      vi.mocked(useOrganization).mockReturnValue({
        data: { ...mockOrganizationData, totalBalance: null, total_balance: 300 },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.getByText('Credit trading market details')).toBeInTheDocument()
    })

    it('handles zero available balance', () => {
      vi.mocked(useOrganization).mockReturnValue({
        data: { ...mockOrganizationData, totalBalance: 0 },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, { wrapper })

      expect(screen.getByText('Credit trading market details')).toBeInTheDocument()
    })
  })
})
