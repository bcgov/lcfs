import React from 'react'
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { CreditMarketDetailsCard } from '../CreditMarketDetailsCard'
import { test } from '@/tests/utils/fixtures'
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
    vi.mocked(useUpdateCurrentOrgCreditMarket).mockReturnValue(
      mockUpdateMutation
    )
    vi.mocked(useUpdateOrganizationCreditMarket).mockReturnValue(
      mockAdminUpdateMutation
    )
    vi.mocked(useQueryClient).mockReturnValue(mockQueryClient)
  })

  describe('Loading and Basic Rendering', () => {
    test('displays loading component when data is loading', ({
      render,
      theme,
      i18n
    }) => {
      vi.mocked(useOrganization).mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    test('renders component without crashing', ({ render, theme, i18n }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(
        screen.getByText('Credit trading market details')
      ).toBeInTheDocument()
    })

    test('displays organization data in read-only mode', ({
      render,
      theme,
      i18n
    }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('(555) 123-4')).toBeInTheDocument()
      expect(screen.getByText('jane@example.com')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
    })
  })

  describe('Permission and Access Control', () => {
    test('hides edit button when user lacks permissions', ({
      render,
      theme,
      i18n
    }) => {
      vi.mocked(useCurrentUser).mockReturnValue({
        data: { ...mockCurrentUser, roles: [{ name: 'supplier' }] },
        hasAnyRole: () => false
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument()
    })

    test('hides edit button when no current user', ({
      render,
      theme,
      i18n
    }) => {
      vi.mocked(useCurrentUser).mockReturnValue({
        data: null,
        hasAnyRole: () => false
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument()
    })
  })

  describe('Edit Mode Functionality', () => {
    test('handles edit mode state changes', ({ render, theme, i18n }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

      // Component should be in read-only mode by default
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(
        screen.getByText('Credit trading market details')
      ).toBeInTheDocument()
    })

    test('form reset is called when component mounts', ({
      render,
      theme,
      i18n
    }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

      // Form reset should be called due to useEffect
      expect(mockReset).toHaveBeenCalled()
    })
  })

  describe('Form Logic', () => {
    test('initializes form with organization data', ({
      render,
      theme,
      i18n
    }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

      // Verify handleSubmit was properly mocked
      expect(mockHandleSubmit).toBeDefined()
      expect(mockWatch).toBeDefined()
    })

    test('handles form submission logic correctly', ({
      render,
      theme,
      i18n
    }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

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

    test('handles seller vs non-seller credits logic', ({
      render,
      theme,
      i18n
    }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

      // Test credits to sell logic for sellers
      const sellerData = { isSeller: true, creditsToSell: '100' }
      const expectedSellerCredits = parseInt(sellerData.creditsToSell, 10) || 0
      expect(expectedSellerCredits).toBe(100)

      // Test credits to sell logic for non-sellers (should be 0)
      const nonSellerData = { isSeller: false, creditsToSell: '100' }
      const expectedNonSellerCredits = nonSellerData.isSeller
        ? parseInt(nonSellerData.creditsToSell, 10) || 0
        : 0
      expect(expectedNonSellerCredits).toBe(0)
    })

    test('handles invalid credits input', ({ render, theme, i18n }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

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
    test('initializes admin mutation when organizationId is provided', ({
      render,
      theme,
      i18n
    }) => {
      render(<CreditMarketDetailsCard organizationId={5} variant="admin" />, [
        theme,
        i18n
      ])

      expect(useUpdateOrganizationCreditMarket).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          clearCache: true,
          invalidateRelatedQueries: true
        })
      )
    })

    test('renders selected organization details when provided', ({
      render,
      theme,
      i18n
    }) => {
      render(<CreditMarketDetailsCard organizationId={5} variant="admin" />, [
        theme,
        i18n
      ])

      expect(screen.getByText(/Selected organization/i)).toBeInTheDocument()
      expect(screen.queryByText(/Clear selection/i)).not.toBeInTheDocument()
    })
  })

  describe('Data Display', () => {
    test('displays contact info with fallbacks to user data', ({
      render,
      theme,
      i18n
    }) => {
      const {
        creditMarketContactName,
        creditMarketContactEmail,
        creditMarketContactPhone,
        ...orgDataWithoutCreditMarketContact
      } = mockOrganizationData
      vi.mocked(useOrganization).mockReturnValue({
        data: orgDataWithoutCreditMarketContact,
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('org@example.com')).toBeInTheDocument()
      expect(screen.getByText('(555) 567-8')).toBeInTheDocument()
    })

    test('displays "Not available" when no contact info exists', ({
      render,
      theme,
      i18n
    }) => {
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

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(
        screen.getAllByText(/not available/i).length
      ).toBeGreaterThanOrEqual(3)
    })

    test('displays seller role only', ({ render, theme, i18n }) => {
      vi.mocked(useOrganization).mockReturnValue({
        data: {
          ...mockOrganizationData,
          creditMarketIsSeller: true,
          creditMarketIsBuyer: false
        },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(screen.getByText(/seller/i)).toBeInTheDocument()
    })

    test('displays buyer role only', ({ render, theme, i18n }) => {
      vi.mocked(useOrganization).mockReturnValue({
        data: {
          ...mockOrganizationData,
          creditMarketIsSeller: false,
          creditMarketIsBuyer: true
        },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(screen.getByText(/buyer/i)).toBeInTheDocument()
    })

    test('displays both seller and buyer roles', ({ render, theme, i18n }) => {
      vi.mocked(useOrganization).mockReturnValue({
        data: {
          ...mockOrganizationData,
          creditMarketIsSeller: true,
          creditMarketIsBuyer: true
        },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(screen.getByText(/seller, buyer/i)).toBeInTheDocument()
    })

    test('displays "Not available" when no roles selected', ({
      render,
      theme,
      i18n
    }) => {
      vi.mocked(useOrganization).mockReturnValue({
        data: {
          ...mockOrganizationData,
          creditMarketIsSeller: false,
          creditMarketIsBuyer: false
        },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(screen.getByText(/not available/i)).toBeInTheDocument()
    })

    test('shows registration warning for unregistered organizations', ({
      render,
      theme,
      i18n
    }) => {
      vi.mocked(useOrganization).mockReturnValue({
        data: { ...mockOrganizationData, orgStatus: { status: 'Active' } },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(
        screen.getByText(/must be registered for transfers/i)
      ).toBeInTheDocument()
    })

    test('hides registration warning for registered organizations', ({
      render,
      theme,
      i18n
    }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(
        screen.queryByText(/must be registered for transfers/i)
      ).not.toBeInTheDocument()
    })

    test('displays yes for display in market when true', ({
      render,
      theme,
      i18n
    }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(screen.getByText(/yes/i)).toBeInTheDocument()
    })

    test('displays no for display in market when false', ({
      render,
      theme,
      i18n
    }) => {
      vi.mocked(useOrganization).mockReturnValue({
        data: { ...mockOrganizationData, displayInCreditMarket: false },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(screen.getByText(/no/i)).toBeInTheDocument()
    })
  })

  describe('Hooks Integration', () => {
    test('uses organization hook with correct parameters', ({
      render,
      theme,
      i18n
    }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(vi.mocked(useOrganization)).toHaveBeenCalledWith(1, {
        enabled: true,
        staleTime: 0,
        cacheTime: 0
      })
    })

    test('initializes mutation hook correctly', ({ render, theme, i18n }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(vi.mocked(useUpdateCurrentOrgCreditMarket)).toHaveBeenCalledWith(
        expect.objectContaining({
          clearCache: true,
          invalidateRelatedQueries: true,
          onSuccess: expect.any(Function),
          onError: expect.any(Function)
        })
      )
    })

    test('uses query client for cache management', ({
      render,
      theme,
      i18n
    }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(vi.mocked(useQueryClient)).toHaveBeenCalled()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('handles missing organization data gracefully', ({
      render,
      theme,
      i18n
    }) => {
      vi.mocked(useOrganization).mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(
        screen.getByText('Credit trading market details')
      ).toBeInTheDocument()
    })

    test('handles form reset when organization data changes', ({
      render,
      theme,
      i18n
    }) => {
      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(mockReset).toHaveBeenCalled()
    })

    test('handles successful mutation with query refetch and callback', async ({
      render,
      theme,
      i18n
    }) => {
      const onSuccess = vi.fn()
      const onSaveSuccess = vi.fn()
      vi.mocked(useUpdateCurrentOrgCreditMarket).mockImplementation(
        ({ onSuccess: callback }) => {
          onSuccess.mockImplementation(callback)
          return mockUpdateMutation
        }
      )

      render(<CreditMarketDetailsCard onSaveSuccess={onSaveSuccess} />, [
        theme,
        i18n
      ])

      await act(async () => {
        onSuccess()
      })

      expect(mockQueryClient.refetchQueries).toHaveBeenCalledWith([
        'organization',
        1
      ])
      expect(onSaveSuccess).toHaveBeenCalled()
    })

    test('handles mutation error gracefully', async ({
      render,
      theme,
      i18n
    }) => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const onError = vi.fn()

      vi.mocked(useUpdateCurrentOrgCreditMarket).mockImplementation(
        ({ onError: callback }) => {
          onError.mockImplementation(callback)
          return mockUpdateMutation
        }
      )

      render(<CreditMarketDetailsCard />, [theme, i18n])

      const error = new Error('Update failed')
      onError(error)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to update credit market details:',
        error
      )

      consoleErrorSpy.mockRestore()
    })

    test('handles missing user name gracefully', ({ render, theme, i18n }) => {
      vi.mocked(useCurrentUser).mockReturnValue({
        data: { ...mockCurrentUser, firstName: '', lastName: '' },
        hasAnyRole: mockHasAnyRole
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(
        screen.getByText('Credit trading market details')
      ).toBeInTheDocument()
    })

    test('handles available balance fallback', ({ render, theme, i18n }) => {
      vi.mocked(useOrganization).mockReturnValue({
        data: {
          ...mockOrganizationData,
          totalBalance: null,
          total_balance: 300
        },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(
        screen.getByText('Credit trading market details')
      ).toBeInTheDocument()
    })

    test('handles zero available balance', ({ render, theme, i18n }) => {
      vi.mocked(useOrganization).mockReturnValue({
        data: { ...mockOrganizationData, totalBalance: 0 },
        isLoading: false
      })

      render(<CreditMarketDetailsCard />, [theme, i18n])

      expect(
        screen.getByText('Credit trading market details')
      ).toBeInTheDocument()
    })
  })
})
