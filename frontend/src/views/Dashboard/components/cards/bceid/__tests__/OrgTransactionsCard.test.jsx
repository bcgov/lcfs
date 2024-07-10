import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrgTransactionsCard } from '../OrgTransactionsCard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOrganization } from '@/hooks/useOrganization'
import { useTransactionsOrgTransfersInProgress } from '@/hooks/useTransactions'
import { useTranslation } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import theme from '@/themes'

// Mock the hooks
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useOrganization')
vi.mock('@/hooks/useTransactions')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('OrgTransactionsCard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('displays loading state', () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: { organization: { organizationId: '1' } } })
    vi.mocked(useOrganization).mockReturnValue({ isLoading: true })
    vi.mocked(useTransactionsOrgTransfersInProgress).mockReturnValue({ isLoading: true })

    render(<OrgTransactionsCard />, { wrapper: createWrapper() })

    expect(screen.getByText('org:cards.orgTransactions.loading')).toBeInTheDocument()
  })

  it('displays organization name and transfers in progress', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: { organization: { organizationId: '1' } } })
    vi.mocked(useOrganization).mockReturnValue({ data: { name: 'Test Organization' }, isLoading: false })
    vi.mocked(useTransactionsOrgTransfersInProgress).mockReturnValue({ data: { transfersInProgress: 5 }, isLoading: false })

    render(<OrgTransactionsCard />, { wrapper: createWrapper() })

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders transaction list items', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: { organization: { organizationId: '1' } } })
    vi.mocked(useOrganization).mockReturnValue({ data: { name: 'Test Organization' }, isLoading: false })
    vi.mocked(useTransactionsOrgTransfersInProgress).mockReturnValue({ data: { transfersInProgress: 5 }, isLoading: false })

    render(<OrgTransactionsCard />, { wrapper: createWrapper() })

    await waitFor(() => expect(screen.getByText('org:cards.orgTransactions.transfersInProgress')).toBeInTheDocument())
    expect(screen.getByText('org:cards.orgTransactions.organizationsRegistered')).toBeInTheDocument()
    expect(screen.getByText('org:cards.orgTransactions.startNewTransfer')).toBeInTheDocument()
  })
})
