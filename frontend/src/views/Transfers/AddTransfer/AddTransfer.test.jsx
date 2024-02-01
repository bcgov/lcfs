import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor
} from '@testing-library/react'
import {
  QueryClient,
  QueryClientProvider,
  useMutation
} from '@tanstack/react-query'
import { BrowserRouter as Router } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

const mockCurrentUser = {
  organization: { organization_id: 1, name: 'Current Organization' }
}

const mockOrganizations = [
  { value: '1', name: 'Organization 1' },
  { value: '2', name: 'Organization 2' }
]

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: mockCurrentUser })
}))

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useMutation: () => ({
      mutate: vi.fn((data) => data),
      isLoading: false,
      isError: false
    })
  }
})

vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    get: vi.fn(() => Promise.resolve({ data: mockOrganizations }))
  })
}))

// eslint-disable-next-line import/first
import { AddTransfer } from './AddTransfer'

const renderComponent = () => {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <Router>
          <AddTransfer />
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('AddTransfer Component Tests', () => {
  beforeEach(() => {
    render(renderComponent())
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the AddTransfer component', () => {
    const addTransferElement = screen.getByText(/New Transfer/i)
    expect(addTransferElement).toBeInTheDocument()
  })

  it('fetches and displays organizations correctly', async () => {
    // Find and click the dropdown to open it
    const dropdown = screen.getByRole('combobox')
    fireEvent.mouseDown(dropdown)

    // Now that the dropdown is open, search for your menu item
    const organizationElement = await screen.findByText('Organization 1')
    expect(organizationElement).toBeInTheDocument()
  })

  it('submits the form with correct data', async () => {
    // Fill in the quantity
    const quantityInput = screen.getByPlaceholderText('Quantity')
    fireEvent.change(quantityInput, { target: { value: '10' } })

    // Select an organization
    const organizationSelect = screen.getByRole('combobox')
    fireEvent.mouseDown(organizationSelect)
    const organizationOption = await screen.findByText('Organization 1')
    fireEvent.click(organizationOption)

    // Fill in the price per unit
    const priceInput = screen.getByPlaceholderText(
      'The fair market value of any consideration, in CAD'
    )
    fireEvent.change(priceInput, { target: { value: '20' } })

    // Set the agreement date
    const dateInput = screen.getByTestId('transfer-agreement-date-input')
    fireEvent.change(dateInput, { target: { value: '2023-01-01' } })

    const form = screen.getByTestId('new-transfer-form')

    // Debug output before submission
    screen.debug()

    // Submit the form
    fireEvent.submit(form)
  })
})
