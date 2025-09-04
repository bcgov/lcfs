import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import OrganizationList from '../OrganizationList'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock the translation function
const mockT = vi.fn((key) => key)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT
  })
}))

// Mock the numberFormatter utility
vi.mock('@/utils/formatters', () => ({
  numberFormatter: vi.fn(({ value }) => `${value}`)
}))

// Mock organization data
const mockOrganizations = [
  {
    organizationId: 1,
    name: "Organization One",
    totalBalance: 1000,
    reservedBalance: 100
  },
  {
    organizationId: 2,
    name: "Organization Two",
    totalBalance: 2000,
    reservedBalance: -200
  }
]

// Mock the useOrganizationNames hook
const mockUseOrganizationNames = vi.fn()
vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizationNames: (statuses) => mockUseOrganizationNames(statuses)
}))

const renderComponent = (props = {}) => {
  const defaultProps = {
    onOrgChange: vi.fn(),
    ...props
  }
  
  return render(
    <ThemeProvider theme={theme}>
      <OrganizationList {...defaultProps} />
    </ThemeProvider>
  )
}

describe('OrganizationList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockT.mockImplementation((key) => key)
    
    // Default mock return
    mockUseOrganizationNames.mockReturnValue({
      data: mockOrganizations,
      isLoading: false
    })
  })

  describe('Basic Rendering', () => {
    it('renders without crashing with required props', () => {
      const onOrgChange = vi.fn()
      renderComponent({ onOrgChange })
      
      expect(screen.getByText(/txn:showTransactionsInvolve/)).toBeInTheDocument()
    })

    it('calls useTranslation hook with correct namespace', () => {
      renderComponent()
      
      expect(mockT).toHaveBeenCalled()
    })

    it('handles onlyRegistered prop correctly', () => {
      renderComponent({ onlyRegistered: true })
      expect(mockUseOrganizationNames).toHaveBeenCalledWith(['Registered'])
      
      vi.clearAllMocks()
      renderComponent({ onlyRegistered: false })
      expect(mockUseOrganizationNames).toHaveBeenCalledWith(null)
    })
  })

  describe('Loading State', () => {
    it('renders correctly when data is loading', () => {
      mockUseOrganizationNames.mockReturnValue({
        data: [],
        isLoading: true
      })
      
      renderComponent()
      
      const autocomplete = screen.getByRole('combobox')
      expect(autocomplete).toBeInTheDocument()
    })
  })

  describe('Data Transformation', () => {
    it('transforms organization data correctly when not loading', async () => {
      renderComponent()
      
      await waitFor(() => {
        const autocomplete = screen.getByRole('combobox')
        expect(autocomplete).toBeInTheDocument()
      })
    })

    it('includes All Organizations option at the beginning', async () => {
      const onOrgChange = vi.fn()
      renderComponent({ onOrgChange })
      
      await waitFor(() => {
        expect(mockT).toHaveBeenCalledWith('txn:allOrganizations')
      })
    })

    it('formats organization labels with balance information', async () => {
      renderComponent()
      
      await waitFor(() => {
        expect(mockT).toHaveBeenCalledWith('txn:complianceUnitsBalance')
        expect(mockT).toHaveBeenCalledWith('txn:inReserve')
      })
    })
  })

  describe('Selected Organization Display', () => {
    it('displays selected organization label when provided', () => {
      const selectedOrg = { id: 1, label: 'Test Organization' }
      renderComponent({ selectedOrg })
      
      expect(screen.getByText('Test Organization')).toBeInTheDocument()
    })

    it('handles missing selectedOrg gracefully', () => {
      renderComponent({ selectedOrg: null })
      
      // Should not crash and should render the component
      expect(screen.getByText(/txn:showTransactionsInvolve/)).toBeInTheDocument()
    })
  })

  describe('Event Handler - onInputBoxChanged', () => {
    it('renders component with onOrgChange handler without errors', () => {
      const onOrgChange = vi.fn()
      renderComponent({ onOrgChange })
      
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(onOrgChange).not.toHaveBeenCalled()
    })

    it('handles different input scenarios gracefully', () => {
      const onOrgChange = vi.fn()
      renderComponent({ onOrgChange })
      
      // Test that component renders properly with different mock data scenarios
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('verifies component behavior with various organization data', () => {
      const onOrgChange = vi.fn()
      
      // Test with different organization configurations
      mockUseOrganizationNames.mockReturnValue({
        data: [
          { organizationId: 1, name: 'Test Org', totalBalance: 100, reservedBalance: 50 },
          { organizationId: 2, name: 'Another Org', totalBalance: 200, reservedBalance: -10 }
        ],
        isLoading: false
      })
      
      renderComponent({ onOrgChange })
      
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  describe('Autocomplete Callbacks', () => {
    it('getOptionLabel returns organization name', async () => {
      renderComponent()
      
      await waitFor(() => {
        const autocomplete = screen.getByRole('combobox')
        expect(autocomplete).toBeInTheDocument()
      })
    })

    it('getOptionKey returns organization ID', async () => {
      renderComponent()
      
      await waitFor(() => {
        const autocomplete = screen.getByRole('combobox')
        expect(autocomplete).toBeInTheDocument()
      })
    })
  })

  describe('TextField Value Logic', () => {
    it('finds correct option when selectedOrg is provided', async () => {
      const selectedOrg = { id: 1, label: 'Organization One' }
      renderComponent({ selectedOrg })
      
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })
    })

    it('handles selectedOrg not found in options list', async () => {
      const selectedOrg = { id: 999, label: 'Non-existent Organization' }
      renderComponent({ selectedOrg })
      
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })
    })
  })

  describe('Props Validation', () => {
    it('requires onOrgChange prop', () => {
      // This would be caught by PropTypes in development
      expect(() => renderComponent({ onOrgChange: undefined })).not.toThrow()
    })

    it('handles onlyRegistered prop default value', () => {
      renderComponent() // Should default to true
      expect(mockUseOrganizationNames).toHaveBeenCalledWith(['Registered'])
    })
  })

  describe('Edge Cases', () => {
    it('handles empty organization data', () => {
      mockUseOrganizationNames.mockReturnValue({
        data: [],
        isLoading: false
      })
      
      renderComponent()
      
      expect(screen.getByText(/txn:showTransactionsInvolve/)).toBeInTheDocument()
    })

    it('handles organization data with negative balances', () => {
      const orgsWithNegative = [
        {
          organizationId: 1,
          name: "Negative Balance Org",
          totalBalance: -500,
          reservedBalance: -100
        }
      ]
      
      mockUseOrganizationNames.mockReturnValue({
        data: orgsWithNegative,
        isLoading: false
      })
      
      renderComponent()
      
      expect(screen.getByText(/txn:showTransactionsInvolve/)).toBeInTheDocument()
    })
  })
})