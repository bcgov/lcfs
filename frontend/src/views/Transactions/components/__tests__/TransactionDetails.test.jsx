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
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: vi.fn((key) => key)
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
  reservedBalance: 100
}

const WrapperComponent = (props) => {
  const queryClient = new QueryClient()
  const methods = useForm()
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

describe('TransactionDetails Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useOrganizationNames.mockReturnValue({
      data: mockOrganizations,
      isLoading: false
    })

    useOrganizationBalance.mockReturnValue({
      data: mockBalance,
      isLoading: false
    })
  })

  it('calls useOrganizationNames with null to get all organizations', () => {
    const TestComponent = () => {
      const methods = useForm()
      return (
        <FormProvider {...methods}>
          <TransactionDetails transactionId={null} isEditable={true} />
        </FormProvider>
      )
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider theme={theme}>
          <MemoryRouter>
            <TestComponent />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    )

    expect(useOrganizationNames).toHaveBeenCalledWith(null)
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('populates organization dropdown correctly', async () => {
    render(<WrapperComponent transactionId={null} isEditable={true} />)

    // Open the organization dropdown
    const selectElement = screen.getByLabelText(/txn:selectOrgLabel/i)
    fireEvent.mouseDown(selectElement)

    // Wait for the options to be displayed
    await waitFor(() => {
      const listbox = screen.getByRole('listbox')
      expect(listbox).toBeInTheDocument()
    })

    // Assert the options are populated
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(1)

    const optionOne = screen.getByText(/Organization One/i)
    const optionTwo = screen.getByText(/Organization Two/i)

    expect(optionOne).toBeInTheDocument()
    expect(optionTwo).toBeInTheDocument()
  })

  it('displays organization balance correctly', async () => {
    render(<WrapperComponent transactionId={null} isEditable={true} />)

    // Open the organization dropdown
    const selectElement = screen.getByLabelText(/txn:selectOrgLabel/i)
    fireEvent.mouseDown(selectElement)

    // Wait for the options to be displayed and select one
    await waitFor(() => screen.getByText(/Organization One/i))
    fireEvent.click(screen.getByText(/Organization One/i))

    // Check if the balance is displayed correctly
    await waitFor(() => {
      expect(screen.getByText(/txn:complianceBalance/i)).toBeInTheDocument()
      expect(
        screen.getByText(/1,000 \(100 txn:inReserve\)/i)
      ).toBeInTheDocument()
    })
  })
})
