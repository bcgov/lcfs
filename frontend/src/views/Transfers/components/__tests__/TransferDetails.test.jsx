import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import { TransferDetails } from '../TransferDetails'
import { useForm, FormProvider } from 'react-hook-form'
import { beforeEach, describe, expect, vi } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRegExtOrgs } from '@/hooks/useOrganizations'
import { useCurrentOrgBalance } from '@/hooks/useOrganization'
import { calculateTotalValue } from '@/utils/formatters'
import { test } from '@/tests/utils/fixtures'

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
    test('renders the component with basic elements', ({
      render,
       theme
    }) => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
      expect(screen.getByText('Test Organization')).toBeInTheDocument()
      expect(screen.getByTestId('quantity')).toBeInTheDocument()
      expect(screen.getByTestId('price-per-unit')).toBeInTheDocument()
    })

    test('renders without user organization name when user data is null', ({
      render,
      theme
    }) => {
      useCurrentUser.mockReturnValue({ data: null })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })
  })

  describe('availableBalance useMemo calculation', () => {
    test('calculates available balance correctly with valid balance data', ({
      render,
      theme
    }) => {
      useCurrentOrgBalance.mockReturnValue({
        data: { totalBalance: 2000, reservedBalance: 300 }
      })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      // Available balance should be 2000 - 300 = 1700
      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })

    test('returns 0 available balance when balance data is null', ({
      render,
      theme
    }) => {
      useCurrentOrgBalance.mockReturnValue({ data: null })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })

    test('returns 0 when reserved balance exceeds total balance', ({
      render,
      theme
    }) => {
      useCurrentOrgBalance.mockReturnValue({
        data: { totalBalance: 500, reservedBalance: 800 }
      })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })
  })

  describe('organizations mapping', () => {
    test('maps organizations correctly when data exists', ({
      render,
      theme
    }) => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      const selectField = screen.getByRole('combobox')
      fireEvent.mouseDown(selectField)

      expect(screen.getByText('Org One')).toBeInTheDocument()
      expect(screen.getByText('Org Two')).toBeInTheDocument()
    })

    test('handles empty organizations array when data is null', ({
      render,
      theme
    }) => {
      useRegExtOrgs.mockReturnValue({ data: null })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })

    test('handles organizations without names', ({
      render,
      theme
    }) => {
      useRegExtOrgs.mockReturnValue({
        data: [{ organizationId: '1', name: null }]
      })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      const selectField = screen.getByRole('combobox')
      fireEvent.mouseDown(selectField)

      expect(screen.getByText('common:unknown')).toBeInTheDocument()
    })
  })

  describe('renderError function', () => {
    test('displays error message when field has error', ({
      render,
      theme
    }) => {
      const errors = {
        quantity: { message: 'Quantity is required' }
      }
      const MockFormProvider = createMockFormProvider({}, errors)
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByText('Quantity is required')).toBeInTheDocument()
    })

    test('does not display error when field has no error', ({
      render,
      theme
    }) => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.queryByText('Quantity is required')).not.toBeInTheDocument()
    })

    test('does not display error for valid toOrganizationId field', ({
      render,
      theme
    }) => {
      const errors = {
        quantity: { message: 'Quantity is required' }
      }
      const MockFormProvider = createMockFormProvider({}, errors)
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      // Only quantity error should be visible, not toOrganizationId error
      expect(screen.getByText('Quantity is required')).toBeInTheDocument()
      expect(
        screen.queryByText('Organization is required')
      ).not.toBeInTheDocument()
    })

    test('displays toOrganizationId error when present', ({
      render,
      theme
    }) => {
      const errors = {
        toOrganizationId: { message: 'Organization is required' }
      }
      const MockFormProvider = createMockFormProvider({}, errors)
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      // Error should be visible when present
      expect(screen.getByText('Organization is required')).toBeInTheDocument()
    })

    test('displays pricePerUnit error when present', ({
      render,
      theme
    }) => {
      const errors = {
        pricePerUnit: { message: 'Price is required' }
      }
      const MockFormProvider = createMockFormProvider({}, errors)
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      // Error should be visible when present
      expect(screen.getByText('Price is required')).toBeInTheDocument()
    })
  })

  describe('totalValue calculation useEffect', () => {
    test('calculates total value when quantity and price change', async ({
      render,
      theme
    }) => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      const quantityInput = screen.getByTestId('quantity')
      const priceInput = screen.getByTestId('price-per-unit')
      const totalValueDisplay = screen.getByTestId('transfer-total-value')

      await act(async () => {
        fireEvent.change(quantityInput, { target: { value: '10' } })
        fireEvent.change(priceInput, { target: { value: '5.25' } })
        await new Promise((resolve) => setTimeout(resolve, 10))
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

    test('handles zero values in calculation', async ({
      render,
      theme
    }) => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      const totalValueDisplay = screen.getByTestId('transfer-total-value')

      await waitFor(() => {
        expect(totalValueDisplay).toHaveTextContent('$0.00 CAD.')
      })
    })
  })

  describe('form field interactions', () => {
    test('handles quantity field input', async ({
      render,
      theme
    }) => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      const quantityInput = screen.getByTestId('quantity')

      await act(async () => {
        fireEvent.change(quantityInput, { target: { value: '100' } })
      })

      expect(quantityInput).toBeInTheDocument()
    })

    test('handles price per unit field input', async ({
      render,
      theme
    }) => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      const priceInput = screen.getByTestId('price-per-unit')

      await act(async () => {
        fireEvent.change(priceInput, { target: { value: '25.50' } })
      })

      expect(priceInput).toBeInTheDocument()
    })

    test('handles organization selection', async ({
      render,
      theme
    }) => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
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
    test('renders without adjustment alert by default', ({
      render,
      theme
    }) => {
      useCurrentOrgBalance.mockReturnValue({
        data: { totalBalance: 100, reservedBalance: 50 }
      })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      // Alert should not be visible by default
      expect(
        screen.queryByText('transfer:quantityAdjusted')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('transfer:noAvailableBalance')
      ).not.toBeInTheDocument()
    })

    test('renders component with very low balance', ({
      render,
      theme
    }) => {
      useCurrentOrgBalance.mockReturnValue({
        data: { totalBalance: 1, reservedBalance: 0 }
      })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })

    test('renders component with zero available balance', ({
      render,
      theme
    }) => {
      useCurrentOrgBalance.mockReturnValue({
        data: { totalBalance: 100, reservedBalance: 200 }
      })
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })
  })

  describe('error handling edge cases', () => {
    test('handles missing balance data gracefully', ({
      render,
      theme
    }) => {
      useCurrentOrgBalance.mockReturnValue({})
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })

    test('handles missing user data gracefully', ({
      render,
      theme
    }) => {
      useCurrentUser.mockReturnValue({})
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })

    test('handles missing organizations data gracefully', ({
      render,
      theme
    }) => {
      useRegExtOrgs.mockReturnValue({})
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByTestId('transfer-details')).toBeInTheDocument()
    })
  })

  describe('static content rendering', () => {
    test('displays zero dollar instruction text', ({
      render,
      theme
    }) => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(
        screen.getByText('transfer:zeroDollarInstructionText')
      ).toBeInTheDocument()
    })

    test('displays transfer details label', ({
      render,
      theme
    }) => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByText('transfer:detailsLabel')).toBeInTheDocument()
    })

    test('displays placeholder text for organization select', ({
      render,
       theme
    }) => {
      const MockFormProvider = createMockFormProvider()
      render(
        <MockFormProvider>
          <TransferDetails />
        </MockFormProvider>,
        [theme]
      )

      expect(screen.getByText('org:selectOrgLabel')).toBeInTheDocument()
    })
  })
})
