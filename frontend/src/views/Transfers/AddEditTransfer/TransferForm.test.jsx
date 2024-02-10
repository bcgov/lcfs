import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'
import TransferInputs from './TransferForm'
import { BrowserRouter as Router } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import theme from '@/themes'

const mockOrganizations = [
  { value: 'org1', name: 'Organization 1' },
  { value: 'org2', name: 'Organization 2' }
]

const mockCurrentOrg = { organization_id: 1, name: 'Current Organization' }

const renderComponent = (currentOrg, organizations) => {
  const WrapperComponent = () => {
    const methods = useForm({
      defaultValues: {
        agreementDate: new Date().toISOString().split('T')[0] // Ensure default date is set to current date
        // Include other default values as needed
      }
    })

    return (
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider theme={theme}>
          <Router>
            <FormProvider {...methods}>
              <TransferInputs
                currentOrg={currentOrg}
                organizations={organizations}
              />
            </FormProvider>
          </Router>
        </ThemeProvider>
      </QueryClientProvider>
    )
  }

  render(<WrapperComponent />)
}

describe('TransferInputs Component Tests', () => {
  beforeEach(() => {
    renderComponent(mockCurrentOrg, mockOrganizations)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the TransferInputs component', () => {
    const transferInputsElement = screen.getByText(/Transfer Details/i)
    expect(transferInputsElement).toBeInTheDocument()
  })

  // Test for form interactions
  it('allows input in the quantity field', () => {
    const quantityInput = screen.getByPlaceholderText('Quantity')
    fireEvent.change(quantityInput, { target: { value: '10' } })
    expect(quantityInput.value).toBe('10')
  })

  // Test for form validation
  // it('displays error message for invalid quantity input', async () => {
  //   const quantityInput = screen.getByPlaceholderText('Quantity');
  //   fireEvent.change(quantityInput, { target: { value: '-5' } });
  //   const errorMessage = await screen.findByText(/Quantity must be positive/i);
  //   expect(errorMessage).toBeInTheDocument();
  // });

  // Test for state updates
  it('updates the total value when quantity and price are changed', async () => {
    const quantityInput = screen.getByPlaceholderText('Quantity')
    const priceInput = screen.getByPlaceholderText(/The fair market value/i)

    fireEvent.change(quantityInput, { target: { value: '10' } })
    fireEvent.change(priceInput, { target: { value: '20' } })

    const totalValue = screen.getByTestId('transfer-total-value')
    expect(totalValue.textContent).toBe('$200.00')
    expect(totalValue).toBeInTheDocument()
  })

  it('renders the agreement date input with the current date as default', () => {
    const currentDate = new Date().toISOString().split('T')[0]
    const agreementDateInput = screen.getByTestId(
      'transfer-agreement-date-input'
    )
    expect(agreementDateInput.value).toBe(currentDate)
  })

  it('allows changing the agreement date', () => {
    const agreementDateInput = screen.getByTestId(
      'transfer-agreement-date-input'
    )
    const testDate = '2023-01-01'
    fireEvent.change(agreementDateInput, { target: { value: testDate } })
    expect(agreementDateInput.value).toBe(testDate)
  })

  // it('displays an error message for a future date', async () => {
  //   const futureDate = new Date();
  //   futureDate.setDate(futureDate.getDate() + 1); // Set date to tomorrow
  //   const formattedFutureDate = futureDate.toISOString().split('T')[0];

  //   const agreementDateInput = screen.getByTestId('transfer-agreement-date-input');
  //   fireEvent.change(agreementDateInput, { target: { value: formattedFutureDate } });

  //   const errorMessage = await screen.findByText(/Agreement Date cannot be in the future/i);
  //   expect(errorMessage).toBeInTheDocument();
  // });
})
