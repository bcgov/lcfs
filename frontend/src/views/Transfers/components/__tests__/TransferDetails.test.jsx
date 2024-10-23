import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TransferDetails } from '../TransferDetails'
import { useForm, FormProvider } from 'react-hook-form'
import { vi } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRegExtOrgs } from '@/hooks/useOrganizations'
import { calculateTotalValue } from '@/utils/formatters'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganizations')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  }),
}))

// MockFormProvider Component
const MockFormProvider = ({ children }) => {
  const methods = useForm({
    defaultValues: {
      toOrganizationId: '',
      quantity: '',
      pricePerUnit: '',
    },
    mode: 'onBlur',
  })
  return <FormProvider {...methods}>{children}</FormProvider>
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
  })

  test('renders correctly with user organization name', () => {
    render(
      <MockFormProvider>
        <TransferDetails />
      </MockFormProvider>,
      { wrapper }
    )
    expect(screen.getByText('Test Organization')).toBeInTheDocument()
  })

  test('renders quantity and price per unit fields', () => {
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

  test('calculates total value correctly with cents', async () => {
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

    // Wait for state updates
    await waitFor(() => {
      const expectedTotalValue = calculateTotalValue(10, 5.25)
      expect(totalValueDisplay).toHaveTextContent(
        `${expectedTotalValue.toLocaleString('en-CA', {
          style: 'currency',
          currency: 'CAD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} CAD.`
      )
    })
  })

  test('updates total value when inputs change with cents', async () => {
    render(
      <MockFormProvider>
        <TransferDetails />
      </MockFormProvider>,
      { wrapper }
    )
    const quantityInput = screen.getByTestId('quantity')
    const priceInput = screen.getByTestId('price-per-unit')
    const totalValueDisplay = screen.getByTestId('transfer-total-value')

    // Initial values with cents
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

  test('selects an organization from the dropdown', async () => {
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
})
