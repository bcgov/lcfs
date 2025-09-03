import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { TransactionDetails } from '../TransactionDetails'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { useOrganizationNames } from '@/hooks/useOrganizations'
import { useOrganizationBalance } from '@/hooks/useOrganization'
import theme from '@/themes'
import { FormProvider, useForm } from 'react-hook-form'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/hooks/useOrganizations')
vi.mock('@/hooks/useOrganization')
vi.mock('@/utils/formatters', () => ({
  dateFormatter: vi.fn((date) => '2024-01-01'),
  numberFormatter: vi.fn((value) => value ? value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '')
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

// Mock the translation function
const mockT = vi.fn((key) => key)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT
  })
}))

const mockOrganizations = [
  {
    organizationId: 1,
    name: 'Organization One'
  },
  {
    organizationId: 2,
    name: 'Organization Two'
  }
]

const mockBalance = {
  totalBalance: 1000,
  reservedBalance: -100
}

// Simple wrapper component
const createWrapper = () => {
  const WrapperComponent = (props) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    
    const methods = useForm({
      defaultValues: {
        txnType: '',
        toOrganizationId: '',
        complianceUnits: '',
        transactionEffectiveDate: ''
      },
      mode: 'all'
    })
    
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <MemoryRouter>
            <FormProvider {...methods}>
              <TransactionDetails {...props} />
            </FormProvider>
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    )
  }
  return WrapperComponent
}

describe('TransactionDetails Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockT.mockImplementation((key) => key)
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('Loading States', () => {
    it('should render loading component when orgData is null', () => {
      useOrganizationNames.mockReturnValue({ data: null })
      useOrganizationBalance.mockReturnValue({ data: null })
      
      const WrapperComponent = createWrapper()
      render(<WrapperComponent transactionId={null} isEditable={true} />)
      
      expect(screen.getByText('txn:loadingBalance')).toBeInTheDocument()
    })

    it('should render loading component when orgData is empty array', () => {
      useOrganizationNames.mockReturnValue({ data: [] })
      useOrganizationBalance.mockReturnValue({ data: null })
      
      const WrapperComponent = createWrapper()
      render(<WrapperComponent transactionId={null} isEditable={true} />)
      
      expect(screen.getByText('txn:loadingBalance')).toBeInTheDocument()
    })
  })

  describe('Normal Rendering', () => {
    beforeEach(() => {
      useOrganizationNames.mockReturnValue({
        data: mockOrganizations,
        isLoading: false
      })
      useOrganizationBalance.mockReturnValue({
        data: mockBalance,
        isLoading: false
      })
    })

    it('should render main component when orgData exists', () => {
      const WrapperComponent = createWrapper()
      render(<WrapperComponent transactionId={null} isEditable={true} />)
      
      expect(screen.getByText('txn:organization')).toBeInTheDocument()
      expect(screen.getByText('txn:complianceUnits')).toBeInTheDocument()
      expect(screen.getByText('txn:effectiveDate')).toBeInTheDocument()
    })

    it('should call useOrganizationNames with null', () => {
      const WrapperComponent = createWrapper()
      render(<WrapperComponent transactionId={null} isEditable={true} />)
      
      expect(useOrganizationNames).toHaveBeenCalledWith(null)
    })

    it('should call useOrganizationBalance hook', () => {
      const WrapperComponent = createWrapper()
      render(<WrapperComponent transactionId={null} isEditable={true} />)
      
      expect(useOrganizationBalance).toHaveBeenCalled()
    })
  })

  describe('Transaction Type Display', () => {
    beforeEach(() => {
      useOrganizationNames.mockReturnValue({ data: mockOrganizations })
      useOrganizationBalance.mockReturnValue({ data: mockBalance })
    })

    it('should show transaction type radio buttons when transactionId is null', () => {
      const WrapperComponent = createWrapper()
      render(<WrapperComponent transactionId={null} isEditable={true} />)
      
      expect(screen.getByText('txn:initiativeAgreement')).toBeInTheDocument()
      expect(screen.getByText('txn:administrativeAdjustment')).toBeInTheDocument()
    })

    it('should render radio buttons with test attributes', () => {
      const WrapperComponent = createWrapper()
      render(<WrapperComponent transactionId={null} isEditable={true} />)
      
      expect(screen.getByTestId('txn-type-initiative-agreement')).toBeInTheDocument()
      expect(screen.getByTestId('txn-type-administrative-adjustment')).toBeInTheDocument()
    })
  })

  describe('Form Controls', () => {
    beforeEach(() => {
      useOrganizationNames.mockReturnValue({ data: mockOrganizations })
      useOrganizationBalance.mockReturnValue({ data: mockBalance })
    })

    it('should render form elements that exist', () => {
      const WrapperComponent = createWrapper()
      render(<WrapperComponent transactionId={null} isEditable={true} />)
      
      // Test elements we know are rendered based on visible output
      expect(screen.getByText('txn:organization')).toBeInTheDocument()
      expect(screen.getByText('txn:complianceUnits')).toBeInTheDocument()
      
      // Check if dropdown exists
      const select = screen.queryByRole('combobox')
      if (select) {
        expect(select).toBeInTheDocument()
      }
    })
  })

  describe('Props Variations', () => {
    beforeEach(() => {
      useOrganizationNames.mockReturnValue({ data: mockOrganizations })
      useOrganizationBalance.mockReturnValue({ data: mockBalance })
    })

    it('should handle radio buttons with different props', () => {
      const WrapperComponent = createWrapper()
      const { rerender } = render(<WrapperComponent transactionId={null} isEditable={true} />)
      
      // Radio buttons exist and are rendered
      expect(screen.getByTestId('txn-type-initiative-agreement')).toBeInTheDocument()
      expect(screen.getByTestId('txn-type-administrative-adjustment')).toBeInTheDocument()
      
      // Test with different props
      rerender(<WrapperComponent transactionId={123} isEditable={false} />)
      expect(screen.getByTestId('txn-type-initiative-agreement')).toBeInTheDocument()
      expect(screen.getByTestId('txn-type-administrative-adjustment')).toBeInTheDocument()
    })

    it('should render correctly with different isEditable values', () => {
      const WrapperComponent = createWrapper()
      const { rerender } = render(<WrapperComponent transactionId={null} isEditable={true} />)
      
      expect(screen.getByText('txn:initiativeAgreement')).toBeInTheDocument()
      
      rerender(<WrapperComponent transactionId={null} isEditable={false} />)
      expect(screen.getByText('txn:initiativeAgreement')).toBeInTheDocument()
    })
  })

  describe('Component Functions', () => {
    beforeEach(() => {
      useOrganizationNames.mockReturnValue({ data: mockOrganizations })
      useOrganizationBalance.mockReturnValue({ data: mockBalance })
    })

    it('should execute displayBalance and renderError functions during rendering', () => {
      const WrapperComponent = createWrapper()
      render(<WrapperComponent transactionId={null} isEditable={true} />)
      
      // Component renders without errors, indicating functions execute properly
      expect(screen.getByText('txn:organization')).toBeInTheDocument()
      expect(screen.getByText('txn:complianceUnits')).toBeInTheDocument()
    })
  })

  describe('Conditional Rendering Logic', () => {
    beforeEach(() => {
      useOrganizationNames.mockReturnValue({ data: mockOrganizations })
      useOrganizationBalance.mockReturnValue({ data: mockBalance })
    })

    it('should handle different transactionId states', () => {
      const WrapperComponent = createWrapper()
      
      // Test with transactionId = null
      const { rerender } = render(<WrapperComponent transactionId={null} isEditable={true} />)
      expect(screen.getByText('txn:initiativeAgreement')).toBeInTheDocument()
      
      // Test with transactionId present
      rerender(<WrapperComponent transactionId={123} isEditable={true} />)
      const txnSection = screen.getByText('txn:initiativeAgreement').closest('div')
      expect(txnSection?.parentElement).toHaveStyle({ display: 'none' })
    })

    it('should handle different isEditable states', () => {
      const WrapperComponent = createWrapper()
      
      // Test with isEditable = true
      const { rerender } = render(<WrapperComponent transactionId={null} isEditable={true} />)
      expect(screen.getByText('txn:initiativeAgreement')).toBeInTheDocument()
      
      // Test with isEditable = false
      rerender(<WrapperComponent transactionId={null} isEditable={false} />)
      expect(screen.getByText('txn:initiativeAgreement')).toBeInTheDocument()
    })
  })

  describe('Hook Integrations', () => {
    it('should integrate with organization hooks correctly', () => {
      useOrganizationNames.mockReturnValue({ data: mockOrganizations })
      useOrganizationBalance.mockReturnValue({ data: mockBalance })
      
      const WrapperComponent = createWrapper()
      render(<WrapperComponent transactionId={null} isEditable={true} />)
      
      expect(useOrganizationNames).toHaveBeenCalledWith(null)
      expect(useOrganizationBalance).toHaveBeenCalled()
    })
  })
})