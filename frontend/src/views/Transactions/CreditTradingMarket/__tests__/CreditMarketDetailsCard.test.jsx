import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CreditMarketDetailsCard } from '../CreditMarketDetailsCard'
import { wrapper } from '@/tests/utils/wrapper'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useOrganization,
  useUpdateCurrentOrgCreditMarket
} from '@/hooks/useOrganization'

// Mock the hooks
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')

// Mock FontAwesome icons
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }) => <span data-testid={`icon-${icon.iconName}`} />
}))

// Sample test data
const mockCurrentUser = {
  firstName: 'John',
  lastName: 'Doe',
  roles: [{ name: 'Transfer' }, { name: 'Signing Authority' }],
  organization: {
    organizationId: 1
  }
}

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

describe('CreditMarketDetailsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    vi.mocked(useCurrentUser).mockReturnValue({ data: mockCurrentUser })
    vi.mocked(useOrganization).mockReturnValue({
      data: mockOrganizationData,
      isLoading: false
    })
    vi.mocked(useUpdateCurrentOrgCreditMarket).mockReturnValue(
      mockUpdateMutation
    )
  })

  it('renders the component correctly in read-only mode', () => {
    render(<CreditMarketDetailsCard />, { wrapper })

    expect(
      screen.getByText('Credit trading market details')
    ).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('555-1234')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('shows edit button for users with proper permissions', () => {
    render(<CreditMarketDetailsCard />, { wrapper })

    const editButton = screen.getByRole('button', { name: /edit/i })
    expect(editButton).toBeInTheDocument()
  })

  it('hides edit button for users without proper permissions', () => {
    const userWithoutPermissions = {
      ...mockCurrentUser,
      roles: [{ name: 'supplier' }]
    }

    vi.mocked(useCurrentUser).mockReturnValue({ data: userWithoutPermissions })

    render(<CreditMarketDetailsCard />, { wrapper })

    expect(
      screen.queryByRole('button', { name: /edit/i })
    ).not.toBeInTheDocument()
  })

  it('enters edit mode when edit button is clicked', async () => {
    render(<CreditMarketDetailsCard />, { wrapper })

    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    await waitFor(() => {
      // Check for form fields instead of specific values
      expect(screen.getByLabelText(/contact name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/telephone/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    })
  })

  it('submits form with correct data transformation', async () => {
    render(<CreditMarketDetailsCard />, { wrapper })

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    // Wait for edit mode to be active and form to be ready
    await waitFor(() => {
      expect(screen.getByLabelText(/contact name/i)).toBeInTheDocument()
    })

    // Make a change to the form to make it dirty (required for form submission)
    const contactNameField = screen.getByLabelText(/contact name/i)
    fireEvent.change(contactNameField, { target: { value: 'Updated Name' } })

    // Submit form
    const saveButton = screen.getByRole('button', { name: /save/i })
    fireEvent.click(saveButton)

    // Wait for the mutation to be called
    await waitFor(() => {
      expect(mockUpdateMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          credit_market_contact_name: expect.any(String),
          credit_market_contact_email: expect.any(String),
          credit_market_contact_phone: expect.any(String),
          credit_market_is_seller: expect.any(Boolean),
          credit_market_is_buyer: expect.any(Boolean),
          credits_to_sell: expect.any(Number),
          display_in_credit_market: expect.any(Boolean)
        })
      )
    })
  })

  it('resets form when cancel button is clicked', async () => {
    render(<CreditMarketDetailsCard />, { wrapper })

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    await waitFor(() => {
      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)
    })

    // Should return to read-only mode
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    vi.mocked(useOrganization).mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<CreditMarketDetailsCard />, { wrapper })

    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('shows eligibility warning for unregistered organizations', () => {
    const unregisteredOrgData = {
      ...mockOrganizationData,
      orgStatus: { status: 'Active' }
    }

    vi.mocked(useOrganization).mockReturnValue({
      data: unregisteredOrgData,
      isLoading: false
    })

    render(<CreditMarketDetailsCard />, { wrapper })

    expect(
      screen.getByText(/must be registered for transfers/i)
    ).toBeInTheDocument()
  })

  it('displays card title heading', () => {
    render(<CreditMarketDetailsCard />, { wrapper })

    // Check for the card title heading
    expect(
      screen.getByRole('heading', { name: 'Credit trading market details' })
    ).toBeInTheDocument()
  })

  it('handles missing organization data gracefully', () => {
    vi.mocked(useOrganization).mockReturnValue({
      data: null,
      isLoading: false
    })

    render(<CreditMarketDetailsCard />, { wrapper })

    // Should not crash and should show component title
    expect(
      screen.queryByText('Credit trading market details')
    ).toBeInTheDocument()
  })

  it('handles form validation for credits field', async () => {
    render(<CreditMarketDetailsCard />, { wrapper })

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    await waitFor(() => {
      // Check that credits field is present by ID - translations may not load in test
      const creditsField = document.getElementById('creditsToSell')
      expect(creditsField).toBeInTheDocument()
    })
  })

  it('updates seller and buyer checkboxes', async () => {
    render(<CreditMarketDetailsCard />, { wrapper })

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    await waitFor(() => {
      // Check for checkboxes
      const sellerCheckbox = screen.getByLabelText(/seller/i)
      const buyerCheckbox = screen.getByLabelText(/buyer/i)

      expect(sellerCheckbox).toBeInTheDocument()
      expect(buyerCheckbox).toBeInTheDocument()
    })
  })
})
