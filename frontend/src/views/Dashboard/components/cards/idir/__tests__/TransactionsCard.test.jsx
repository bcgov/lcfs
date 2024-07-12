import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TransactionsCard } from '../TransactionsCard'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTransactionsTransfersInProgress, useTransactionsInitiativeAgreementsInProgress, useTransactionsAdminAdjustmentsInProgress } from '@/hooks/useTransactions'
import { useTranslation } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import theme from '@/themes'

// Mock the hooks
vi.mock('@/hooks/useCurrentUser')
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

describe('TransactionsCard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('displays loading state', () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: { organization: { organizationId: '1' } } })
    vi.mocked(useTransactionsTransfersInProgress).mockReturnValue({ isLoading: true })
    vi.mocked(useTransactionsInitiativeAgreementsInProgress).mockReturnValue({ isLoading: true })
    vi.mocked(useTransactionsAdminAdjustmentsInProgress).mockReturnValue({ isLoading: true })

    render(<TransactionsCard />, { wrapper: createWrapper() })

    expect(screen.getByText('org:cards.transactions.loading')).toBeInTheDocument()
  })

  it('displays transaction numbers and links', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: { organization: { organizationId: '1' } } })
    vi.mocked(useTransactionsTransfersInProgress).mockReturnValue({ data: { transfersInProgress: 5 }, isLoading: false })
    vi.mocked(useTransactionsInitiativeAgreementsInProgress).mockReturnValue({ data: { initiativeAgreementsInProgress: 3 }, isLoading: false })
    vi.mocked(useTransactionsAdminAdjustmentsInProgress).mockReturnValue({ data: { adminAdjustmentsInProgress: 2 }, isLoading: false })

    render(<TransactionsCard />, { wrapper: createWrapper() })

    await waitFor(() => expect(screen.getByText('org:cards.transactions.transfersInProgress')).toBeInTheDocument())

    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders transaction list items', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: { organization: { organizationId: '1' } } })
    vi.mocked(useTransactionsTransfersInProgress).mockReturnValue({ data: { transfersInProgress: 5 }, isLoading: false })
    vi.mocked(useTransactionsInitiativeAgreementsInProgress).mockReturnValue({ data: { initiativeAgreementsInProgress: 3 }, isLoading: false })
    vi.mocked(useTransactionsAdminAdjustmentsInProgress).mockReturnValue({ data: { adminAdjustmentsInProgress: 2 }, isLoading: false })

    render(<TransactionsCard />, { wrapper: createWrapper() })

    await waitFor(() => expect(screen.getByText('org:cards.transactions.transfersInProgress')).toBeInTheDocument())
    expect(screen.getByText('org:cards.transactions.initiativeAgreementsInProgress')).toBeInTheDocument()
    expect(screen.getByText('org:cards.transactions.administrativeAdjustmentsInProgress')).toBeInTheDocument()
    expect(screen.getByText('org:cards.transactions.viewAllTransactions')).toBeInTheDocument()
  })
})
