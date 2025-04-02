import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

// MockFormProvider Component
const MockFormProvider = ({ children }) => {
  const methods = useForm({
    defaultValues: {
      toOrganizationId: '',
      quantity: '',
      pricePerUnit: ''
    },
    mode: 'onBlur'
  })
  return <FormProvider {...methods}>{children}</FormProvider>
}

// Default balance mock: availableBalance computed as 1500 - 500 = 1000
const mockBalance = {
  data: {
    totalBalance: 1500,
    reservedBalance: 500,
    name: 'Test Organization'
  }
}

describe('TransferDetails Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks()

    useCurrentUser.mockReturnValue({
      data: {
        organization: { name: 'Test Organization' }
      }
    })
    useRegExtOrgs.mockReturnValue({
      data: [
        { organizationId: 1, name: 'Org One' },
        { organizationId: 2, name: 'Org Two' }
      ]
    })
    useCurrentOrgBalance.mockReturnValue(mockBalance)
  })

  it('renders correctly with user organization name', () => {
    render(
      <MockFormProvider>
        <TransferDetails />
      </MockFormProvider>,
      { wrapper }
    )
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
  })

  it('renders quantity and price per unit fields', () => {
    render(
      <MockFormProvider>
        <TransferDetails />
      </MockFormProvider>,
      { wrapper }
    )
    const quantityInput = screen.getByTestId('quantity')
    const priceInput = screen.getByTestId('price-per-unit')

    expect(quantityInput).toBeInTheDocument()
    expect(priceInput).toBeInTheDocument()
  })

  it('calculates total value correctly with cents', async () => {
    render(
      <MockFormProvider>
        <TransferDetails />
      </MockFormProvider>,
      { wrapper }
    )
    const quantityInput = screen.getByTestId('quantity')
    const priceInput = screen.getByTestId('price-per-unit')
    const totalValueDisplay = screen.getByTestId('transfer-total-value')

    // Simulate entering values with cents
    fireEvent.change(quantityInput, { target: { value: '10' } })
    fireEvent.change(priceInput, { target: { value: '5.25' } })

    await waitFor(() => {
      const expectedTotalValue = calculateTotalValue(10, 5.25)
      expect(totalValueDisplay).toHaveTextContent(
        `${expectedTotalValue.toLocaleString('en-CA', {
          style: 'currency',
          currency: 'CAD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} CAD.`
      )
    })
  })

  it('adjusts quantity when exceeding available balance (non-zero case)', async () => {
    render(
      <MockFormProvider>
        <TransferDetails />
      </MockFormProvider>,
      { wrapper }
    )

    const quantityInput = screen.getByTestId('quantity')
    // Attempt to enter a quantity greater than the computed available balance (1000)
    fireEvent.change(quantityInput, { target: { value: '2000' } })

    // FIXME: Neither FireEvent nor UserInput cause ReactNumberFormat to fire its onChange
    // await waitFor(() => {
    //   expect(
    //     screen.getByText(/transfer:quantityAdjusted: 1,000/)
    //   ).toBeInTheDocument()
    // })

    // Verify the input value is adjusted to the available balance
    expect(quantityInput).toHaveValue('1,000')
  })

  it('updates total value when inputs change with cents', async () => {
    render(
      <MockFormProvider>
        <TransferDetails />
      </MockFormProvider>,
      { wrapper }
    )
    const quantityInput = screen.getByTestId('quantity')
    const priceInput = screen.getByTestId('price-per-unit')
    const totalValueDisplay = screen.getByTestId('transfer-total-value')

    // Set initial values with cents
    fireEvent.change(quantityInput, { target: { value: '5' } })
    fireEvent.change(priceInput, { target: { value: '2.50' } })

    await waitFor(() => {
      expect(totalValueDisplay).toHaveTextContent('$12.50 CAD.')
    })

    // Update values with cents
    fireEvent.change(quantityInput, { target: { value: '8' } })
    fireEvent.change(priceInput, { target: { value: '3.75' } })

    await waitFor(() => {
      expect(totalValueDisplay).toHaveTextContent('$30.00 CAD.')
    })
  })

  it('selects an organization from the dropdown', async () => {
    render(
      <MockFormProvider>
        <TransferDetails />
      </MockFormProvider>,
      { wrapper }
    )

    // Find the Select component by its accessible label
    const selectInput = screen.getByLabelText('org:selectOrgLabel')
    fireEvent.mouseDown(selectInput)

    const listbox = await screen.findByRole('listbox')
    expect(listbox).toBeInTheDocument()

    const option = screen.getByText('Org One')
    fireEvent.click(option)

    expect(selectInput).toHaveTextContent('Org One')
  })

  it('renders the zero-dollar instructional text', () => {
    render(
      <MockFormProvider>
        <TransferDetails />
      </MockFormProvider>,
      { wrapper }
    )
    expect(
      screen.getByText('transfer:zeroDollarInstructionText')
    ).toBeInTheDocument()
  })

  it('displays zero available balance warning when reserved exceeds total balance', async () => {
    // Override useCurrentOrgBalance mock with a scenario where reserved > total, resulting in available balance of 0.
    useCurrentOrgBalance.mockReturnValue({
      data: {
        totalBalance: 1000,
        reservedBalance: 1500,
        name: 'Test Organization'
      }
    })

    render(
      <MockFormProvider>
        <TransferDetails />
      </MockFormProvider>,
      { wrapper }
    )

    const quantityInput = screen.getByTestId('quantity')
    // Attempt to enter any positive quantity; NumericFormat will adjust it to 0.
    fireEvent.change(quantityInput, { target: { value: '100' } })

    // FIXME: Neither FireEvent nor UserInput cause ReactNumberFormat to fire its onChange
    // await waitFor(() => {
    //   expect(
    //     screen.getByText(/transfer:noAvailableBalance: 0/)
    //   ).toBeInTheDocument()
    // })

    // Verify the input value is adjusted to 0.
    expect(quantityInput).toHaveValue('0')
  })
})
