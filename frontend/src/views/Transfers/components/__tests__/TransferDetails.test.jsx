import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransferDetails } from '../TransferDetails'
import { useForm, FormProvider } from 'react-hook-form'
import { vi } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRegExtOrgs } from '@/hooks/useOrganization'
import { calculateTotalValue } from '@/utils/formatters'
import { wrapper } from '@/tests/utils/wrapper.jsx'

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

const MockFormProvider = ({ children }) => {
  const methods = useForm()
  return <FormProvider {...methods}>{children}</FormProvider>
}

describe('TransferDetails Component', () => {
  beforeEach(() => {
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
    const priceInput = screen.getByPlaceholderText('transfer:fairMarketText')

    expect(quantityInput).toBeInTheDocument()
    expect(priceInput).toBeInTheDocument()
  })

  test('calculates total value correctly', () => {
    render(
      <MockFormProvider>
        <TransferDetails />
      </MockFormProvider>,
      { wrapper }
    )
    const quantityInput = screen.getByTestId('quantity')
    const priceInput = screen.getByTestId('price-per-unit')
    const totalValueDisplay = screen.getByTestId('transfer-total-value')

    // Simulate entering values
    fireEvent.change(quantityInput, { target: { value: '10' } })
    fireEvent.change(priceInput, { target: { value: '5' } })

    // Assuming calculateTotalValue is defined as quantity * pricePerUnit
    const expectedTotalValue = calculateTotalValue(10, 5)
    expect(totalValueDisplay).toHaveTextContent(
      `${expectedTotalValue.toLocaleString('en-CA', {
        style: 'currency',
        currency: 'CAD'
      })} CAD.`
    )
  })
})
