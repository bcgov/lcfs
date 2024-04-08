describe.todo()
// import theme from '@/themes'
// import { ThemeProvider } from '@mui/material'
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// import { cleanup, fireEvent, render, screen } from '@testing-library/react'
// import { BrowserRouter as Router } from 'react-router-dom'
// import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// const mockCurrentUser = {
//   organization: { organizationId: 1, name: 'Current Organization' }
// }

// const mockOrganizations = [
//   { value: '1', name: 'Organization 1' },
//   { value: '2', name: 'Organization 2' }
// ]

// vi.mock('@/hooks/useCurrentUser', () => ({
//   useCurrentUser: () => ({ data: mockCurrentUser })
// }))

// // Mock @tanstack/react-query
// vi.mock('@tanstack/react-query', async () => {
//   const actual = await vi.importActual('@tanstack/react-query')
//   return {
//     ...actual,
//     useMutation: () => ({
//       mutate: vi.fn((data) => data),
//       isLoading: false,
//       isError: false
//     })
//   }
// })

// vi.mock('@/services/useApiService', () => ({
//   useApiService: () => ({
//     get: vi.fn(() => Promise.resolve({ data: mockOrganizations }))
//   })
// }))

// // eslint-disable-next-line import/first
// import { AddEditTransfer } from './AddEditTransfer/AddEditTransfer'

// const renderComponent = () => {
//   const queryClient = new QueryClient()
//   render(
//     <QueryClientProvider client={queryClient}>
//       <ThemeProvider theme={theme}>
//         <Router>
//           <AddEditTransfer />
//         </Router>
//       </ThemeProvider>
//     </QueryClientProvider>
//   )
// }

// describe('AddTransfer Component Tests', () => {
//   beforeEach(() => {
//     render(renderComponent())
//   })

//   afterEach(() => {
//     cleanup()
//     vi.restoreAllMocks()
//   })

//   it('renders the AddTransfer component', () => {
//     const addTransferElement = screen.getByText(/New Transfer/i)
//     expect(addTransferElement).toBeInTheDocument()
//   })

//   it('fetches and displays organizations correctly', async () => {
//     // Find and click the dropdown to open it
//     const dropdown = screen.getByRole('combobox')
//     fireEvent.mouseDown(dropdown)

//     // Now that the dropdown is open, search for your menu item
//     const organizationElement = await screen.findByText('Organization 1')
//     expect(organizationElement).toBeInTheDocument()
//   })

//   it('submits the form with correct data', async () => {
//     // Fill in the quantity
//     const quantityInput = screen.getByPlaceholderText('Quantity')
//     fireEvent.change(quantityInput, { target: { value: '10' } })

//     // Select an organization
//     const organizationSelect = screen.getByRole('combobox')
//     fireEvent.mouseDown(organizationSelect)
//     const organizationOption = await screen.findByText('Organization 1')
//     fireEvent.click(organizationOption)

//     // Fill in the price per unit
//     const priceInput = screen.getByPlaceholderText(
//       'The fair market value of any consideration, in CAD'
//     )
//     fireEvent.change(priceInput, { target: { value: '20' } })

//     // Set the agreement date
//     const dateInput = screen.getByTestId('transfer-agreement-date-input')
//     fireEvent.change(dateInput, { target: { value: '2023-01-01' } })

//     const form = screen.getByTestId('new-transfer-form')

//     // Debug output before submission
//     screen.debug()

//     // Submit the form
//     fireEvent.submit(form)
//   })

//   it('renders the TransferInputs component', () => {
//     const transferInputsElement = screen.getByText(/Transfer Details/i)
//     expect(transferInputsElement).toBeInTheDocument()
//   })

//   it('allows input in the quantity field', () => {
//     const quantityInput = screen.getByPlaceholderText('Quantity')
//     fireEvent.change(quantityInput, { target: { value: '10' } })
//     expect(quantityInput.value).toBe('10')
//   })

//   it('updates the total value when quantity and price are changed', async () => {
//     const quantityInput = screen.getByPlaceholderText('Quantity')
//     const priceInput = screen.getByPlaceholderText(/The fair market value/i)

//     fireEvent.change(quantityInput, { target: { value: '10' } })
//     fireEvent.change(priceInput, { target: { value: '20' } })

//     const totalValue = screen.getByTestId('transfer-total-value')
//     expect(totalValue.textContent).toBe('$200.00')
//     expect(totalValue).toBeInTheDocument()
//   })

//   it('renders the agreement date input with the current date as default', () => {
//     const currentDate = new Date().toISOString().split('T')[0]
//     const agreementDateInput = screen.getByTestId(
//       'transfer-agreement-date-input'
//     )
//     expect(agreementDateInput.value).toBe(currentDate)
//   })

//   it('allows changing the agreement date', () => {
//     const agreementDateInput = screen.getByTestId(
//       'transfer-agreement-date-input'
//     )
//     const testDate = '2023-01-01'
//     fireEvent.change(agreementDateInput, { target: { value: testDate } })
//     expect(agreementDateInput.value).toBe(testDate)
//   })
// })
