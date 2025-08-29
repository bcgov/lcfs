import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { TransferGraphic } from '../TransferGraphic'

// Import mocked modules (these will be mocked by vi.mock calls)
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRegExtOrgs } from '@/hooks/useOrganizations'
import { useParams } from 'react-router-dom'
import { useTransfer } from '@/hooks/useTransfer'

// Mock all dependencies
const mockWatch = vi.fn()
const mockTheme = createTheme()

// Mock hooks
vi.mock('react-hook-form', () => ({
  useFormContext: () => ({ watch: mockWatch })
}))

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganizations')
vi.mock('react-router-dom', () => ({
  useParams: vi.fn()
}))
vi.mock('@/hooks/useTransfer')
vi.mock('@mui/material/styles', async () => {
  const actual = await vi.importActual('@mui/material/styles')
  return {
    ...actual,
    useTheme: () => mockTheme
  }
})

// Mock BCTypography
vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => (
    <div data-testid="bc-typography" {...props}>
      {children}
    </div>
  )
}))

// Test wrapper component
const TestWrapper = ({ children }) => (
  <ThemeProvider theme={mockTheme}>{children}</ThemeProvider>
)

describe('TransferGraphic Component', () => {

  const mockCurrentUser = {
    organization: { name: 'Current User Organization' }
  }
  const mockOrgData = [
    { organizationId: '123', name: 'Target Organization' },
    { organizationId: '456', name: 'Another Organization' }
  ]
  const mockTransferData = {
    fromOrganization: { name: 'Transfer From Organization' }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock implementations
    mockWatch.mockImplementation((field) => {
      const defaults = {
        quantity: '100',
        pricePerUnit: '25.50',
        toOrganizationId: 123
      }
      return defaults[field]
    })
    
    useCurrentUser.mockReturnValue({ data: mockCurrentUser })
    useRegExtOrgs.mockReturnValue({ data: mockOrgData })
    useParams.mockReturnValue({ transferId: null })
    useTransfer.mockReturnValue({ data: null })
  })

  describe('Basic Component Rendering', () => {
    it('renders transfer graphic container with correct data attribute', () => {
      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )
      
      expect(screen.getByTestId('transfer-graphic')).toBeInTheDocument()
    })

    it('renders from and to organization papers', () => {
      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )
      
      expect(screen.getByText('Current User Organization')).toBeInTheDocument()
      expect(screen.getByText('Target Organization')).toBeInTheDocument()
    })
  })

  describe('Icon Rendering Logic', () => {
    it('renders HorizontalRule icon when quantity is invalid', () => {
      mockWatch.mockImplementation(() => null)

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByTestId('HorizontalRuleIcon')).toBeInTheDocument()
    })

    it('renders TrendingFlat icon when quantity is valid but total value is invalid', () => {
      mockWatch.mockImplementation((field) => {
        const values = {
          quantity: '100',
          pricePerUnit: null
        }
        return values[field]
      })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByTestId('TrendingFlatIcon')).toBeInTheDocument()
    })

    it('renders SyncAlt icon when both quantity and total value are valid', () => {
      mockWatch.mockImplementation((field) => {
        const values = {
          quantity: '100',
          pricePerUnit: '25.50'
        }
        return values[field]
      })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByTestId('SyncAltIcon')).toBeInTheDocument()
    })
  })

  describe('Utility Functions and Display Logic', () => {
    it('displays compliance units when quantity is valid', () => {
      mockWatch.mockImplementation((field) => {
        return field === 'quantity' ? '1500' : null
      })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByText('1,500 compliance units')).toBeInTheDocument()
    })

    it('does not display compliance units when quantity is invalid', () => {
      mockWatch.mockImplementation((field) => {
        return field === 'quantity' ? 'invalid' : null
      })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.queryByText(/compliance units/)).not.toBeInTheDocument()
    })

    it('displays formatted currency when total value is valid', () => {
      mockWatch.mockImplementation((field) => {
        const values = {
          quantity: '100',
          pricePerUnit: '25.50'
        }
        return values[field]
      })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByText('$2,550.00')).toBeInTheDocument()
    })

    it('does not display currency when total value is invalid', () => {
      mockWatch.mockImplementation((field) => {
        const values = {
          quantity: 'invalid',
          pricePerUnit: '25.50'
        }
        return values[field]
      })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    })
  })

  describe('Data Source Logic', () => {
    it('uses current user organization when no transferId', () => {
      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByText('Current User Organization')).toBeInTheDocument()
    })

    it('uses transfer data organization when transferId exists', () => {
      useParams.mockReturnValue({ transferId: '123' })
      useTransfer.mockReturnValue({ data: mockTransferData })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByText('Transfer From Organization')).toBeInTheDocument()
    })

    it('displays correct target organization based on toOrganizationId', () => {
      mockWatch.mockImplementation((field) => {
        return field === 'toOrganizationId' ? 456 : null
      })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByText('Another Organization')).toBeInTheDocument()
    })

  })

  describe('Edge Cases and Validation Logic', () => {
    it('handles zero quantity correctly', () => {
      mockWatch.mockImplementation((field) => {
        return field === 'quantity' ? '0' : null
      })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByTestId('HorizontalRuleIcon')).toBeInTheDocument()
      expect(screen.queryByText(/compliance units/)).not.toBeInTheDocument()
    })

    it('handles negative values correctly', () => {
      mockWatch.mockImplementation((field) => {
        const values = {
          quantity: '-100',
          pricePerUnit: '25.50'
        }
        return values[field]
      })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByTestId('HorizontalRuleIcon')).toBeInTheDocument()
    })

    it('handles string quantity conversion and formatting', () => {
      mockWatch.mockImplementation((field) => {
        return field === 'quantity' ? '1000' : null
      })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByText('1,000 compliance units')).toBeInTheDocument()
    })

    it('handles decimal price calculations correctly', () => {
      mockWatch.mockImplementation((field) => {
        const values = {
          quantity: '100',
          pricePerUnit: '25.99'
        }
        return values[field]
      })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByText('$2,599.00')).toBeInTheDocument()
    })

    it('handles NaN values for quantity', () => {
      mockWatch.mockImplementation((field) => {
        return field === 'quantity' ? 'not-a-number' : null
      })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByTestId('HorizontalRuleIcon')).toBeInTheDocument()
      expect(screen.queryByText(/compliance units/)).not.toBeInTheDocument()
    })

    it('handles zero price correctly', () => {
      mockWatch.mockImplementation((field) => {
        const values = {
          quantity: '100',
          pricePerUnit: '0'
        }
        return values[field]
      })

      render(
        <TestWrapper>
          <TransferGraphic />
        </TestWrapper>
      )

      expect(screen.getByTestId('TrendingFlatIcon')).toBeInTheDocument()
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    })
  })
})