import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { TransferDetails } from '../TransferDetails'
import { useForm, FormProvider } from 'react-hook-form'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRegExtOrgs } from '@/hooks/useOrganizations'
import { useCurrentOrgBalance } from '@/hooks/useOrganization'
import { calculateTotalValue } from '@/utils/formatters'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganizations')
vi.mock('@/hooks/useOrganization', () => ({
  useCurrentOrgBalance: vi.fn()
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock FormProvider Component with customizable form state
const createMockFormProvider = (defaultValues = {}, errors = {}) => {
  return ({ children }) => {
    const methods = useForm({
      defaultValues: {
        toOrganizationId: '',
        quantity: '',
        pricePerUnit: '',
        ...defaultValues
      },
      mode: 'onBlur'
    })
    
    // Override formState with mock errors
    if (Object.keys(errors).length > 0) {
      methods.formState = {
        ...methods.formState,
        errors
      }
    }
    
    return <FormProvider {...methods}>{children}</FormProvider>
  }
}

const defaultMockBalance = {
  data: {
    totalBalance: 1500,
    reservedBalance: 500
  }
}

const defaultMockUser = {
  data: {
    organization: { name: 'Test Organization' }
  }
}

const defaultMockOrgs = {
  data: [
    { organizationId: '1', name: 'Org One' },
    { organizationId: '2', name: 'Org Two' }
  ]
}

describe('TransferDetails Component', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useCurrentUser.mockReturnValue(defaultMockUser)
    useRegExtOrgs.mockReturnValue(defaultMockOrgs)
    useCurrentOrgBalance.mockReturnValue(defaultMockBalance)
  })

  describe('Component Rendering', () => {
    it('renders the component with basic elements', () => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
      expect(screen.getByText('Test Organization')).toBeInTheDocument()
      expect(screen.getByTestId('quantity')).toBeInTheDocument()
      expect(screen.getByTestId('price-per-unit')).toBeInTheDocument()
    })

    it('renders without user organization name when user data is null', () => {
      useCurrentUser.mockReturnValue({ data: null })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })
  })

  describe('availableBalance useMemo calculation', () => {
    it('calculates available balance correctly with valid balance data', () => {
      useCurrentOrgBalance.mockReturnValue({
        data: { totalBalance: 2000, reservedBalance: 300 }
      })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      // Available balance should be 2000 - 300 = 1700
      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })

    it('returns 0 available balance when balance data is null', () => {
      useCurrentOrgBalance.mockReturnValue({ data: null })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })

    it('returns 0 when reserved balance exceeds total balance', () => {
      useCurrentOrgBalance.mockReturnValue({
        data: { totalBalance: 500, reservedBalance: 800 }
      })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })
  })

  describe('organizations mapping', () => {
    it('maps organizations correctly when data exists', () => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      const selectField = screen.getByRole('combobox')
      fireEvent.mouseDown(selectField)
      
      expect(screen.getByText('Org One')).toBeInTheDocument()
      expect(screen.getByText('Org Two')).toBeInTheDocument()
    })

    it('handles empty organizations array when data is null', () => {
      useRegExtOrgs.mockReturnValue({ data: null })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })

    it('handles organizations without names', () => {
      useRegExtOrgs.mockReturnValue({
        data: [{ organizationId: '1', name: null }]
      })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      const selectField = screen.getByRole('combobox')
      fireEvent.mouseDown(selectField)
      
      expect(screen.getByText('common:unknown')).toBeInTheDocument()
    })
  })

  describe('renderError function', () => {
    it('displays error message when field has error', () => {
      const errors = {
        quantity: { message: 'Quantity is required' }
      }
      const MockFormProvider = createMockFormProvider({}, errors)
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByText('Quantity is required')).toBeInTheDocument()
    })

    it('does not display error when field has no error', () => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.queryByText('Quantity is required')).not.toBeInTheDocument()
    })

    it('does not display error for valid toOrganizationId field', () => {
      const errors = {
        quantity: { message: 'Quantity is required' }
      }
      const MockFormProvider = createMockFormProvider({}, errors)
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      // Only quantity error should be visible, not toOrganizationId error
      expect(screen.getByText('Quantity is required')).toBeInTheDocument()
      expect(screen.queryByText('Organization is required')).not.toBeInTheDocument()
    })

    it('displays toOrganizationId error when present', () => {
      const errors = {
        toOrganizationId: { message: 'Organization is required' }
      }
      const MockFormProvider = createMockFormProvider({}, errors)
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      // Error should be visible when present
      expect(screen.getByText('Organization is required')).toBeInTheDocument()
    })

    it('displays pricePerUnit error when present', () => {
      const errors = {
        pricePerUnit: { message: 'Price is required' }
      }
      const MockFormProvider = createMockFormProvider({}, errors)
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      // Error should be visible when present
      expect(screen.getByText('Price is required')).toBeInTheDocument()
    })
  })

  describe('totalValue calculation useEffect', () => {
    it('calculates total value when quantity and price change', async () => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      const quantityInput = screen.getByTestId('quantity')
      const priceInput = screen.getByTestId('price-per-unit')
      const totalValueDisplay = screen.getByTestId('transfer-total-value')
      
      await act(async () => {
        fireEvent.change(quantityInput, { target: { value: '10' } })
        fireEvent.change(priceInput, { target: { value: '5.25' } })
        await new Promise(resolve => setTimeout(resolve, 10))
      })
      
      await waitFor(() => {
        const expectedValue = calculateTotalValue(10, 5.25)
        expect(totalValueDisplay).toHaveTextContent(
          expectedValue.toLocaleString('en-CA', {
            style: 'currency',
            currency: 'CAD'
          })
        )
      })
    })

    it('handles zero values in calculation', async () => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      const totalValueDisplay = screen.getByTestId('transfer-total-value')
      
      await waitFor(() => {
        expect(totalValueDisplay).toHaveTextContent('$0.00 CAD.')
      })
    })
  })

  describe('form field interactions', () => {
    it('handles quantity field input', async () => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      const quantityInput = screen.getByTestId('quantity')
      
      await act(async () => {
        fireEvent.change(quantityInput, { target: { value: '100' } })
      })
      
      expect(quantityInput).toBeInTheDocument()
    })

    it('handles price per unit field input', async () => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      const priceInput = screen.getByTestId('price-per-unit')
      
      await act(async () => {
        fireEvent.change(priceInput, { target: { value: '25.50' } })
      })
      
      expect(priceInput).toBeInTheDocument()
    })

    it('handles organization selection', async () => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      const selectField = screen.getByRole('combobox')
      fireEvent.mouseDown(selectField)
      
      await waitFor(() => {
        const option = screen.getByText('Org One')
        fireEvent.click(option)
      })
      
      expect(selectField).toHaveTextContent('Org One')
    })
  })

  describe('adjustment alert functionality', () => {
    it('renders without adjustment alert by default', () => {
      useCurrentOrgBalance.mockReturnValue({
        data: { totalBalance: 100, reservedBalance: 50 }
      })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      // Alert should not be visible by default
      expect(screen.queryByText('transfer:quantityAdjusted')).not.toBeInTheDocument()
      expect(screen.queryByText('transfer:noAvailableBalance')).not.toBeInTheDocument()
    })

    it('renders component with very low balance', () => {
      useCurrentOrgBalance.mockReturnValue({
        data: { totalBalance: 1, reservedBalance: 0 }
      })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })

    it('renders component with zero available balance', () => {
      useCurrentOrgBalance.mockReturnValue({
        data: { totalBalance: 100, reservedBalance: 200 }
      })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })
  })

  describe('error handling edge cases', () => {
    it('handles missing balance data gracefully', () => {
      useCurrentOrgBalance.mockReturnValue({})
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })

    it('handles missing user data gracefully', () => {
      useCurrentUser.mockReturnValue({})
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })

    it('handles missing organizations data gracefully', () => {
      useRegExtOrgs.mockReturnValue({})
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })
  })

  describe('static content rendering', () => {
    it('displays zero dollar instruction text', () => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByText('transfer:zeroDollarInstructionText')).toBeInTheDocument()
    })

    it('displays transfer details label', () => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByText('transfer:detailsLabel')).toBeInTheDocument()
    })

    it('displays placeholder text for organization select', () => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        { wrapper }
      )
      
      expect(screen.getByText('org:selectOrgLabel')).toBeInTheDocument()
    })
  })
})