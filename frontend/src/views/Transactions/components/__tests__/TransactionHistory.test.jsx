import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionHistory } from '../TransactionHistory'
// import { useTranslation } from 'react-i18next'
import { ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.extend(localizedFormat)

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

const renderComponent = (props) => {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <TransactionHistory {...props} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('TransactionHistory Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockTransactionHistory = [
    {
      createDate: '2023-05-01',
      adminAdjustmentStatus: { status: 'Approved' },
      initiativeAgreementStatus: null,
      userProfile: { firstName: 'John', lastName: 'Doe' }
    },
    {
      createDate: '2023-05-02',
      adminAdjustmentStatus: null,
      initiativeAgreementStatus: { status: 'Recommended' },
      userProfile: { firstName: 'Jane', lastName: 'Smith' }
    }
  ]

  it('renders without crashing', () => {
    renderComponent({ transactionHistory: [{userProfile: { firstName: 'Jane', lastName: 'Smith' }}] })
    expect(screen.getByText('Transaction History')).toBeInTheDocument()
  })

  it('displays transaction history items correctly', () => {
    renderComponent({ transactionHistory: mockTransactionHistory })
    expect(screen.getByText(/Approved/i)).toBeInTheDocument()
    expect(screen.getByText(/May 1, 2023/i)).toBeInTheDocument()
    expect(screen.getByText(/Recommended/i)).toBeInTheDocument()
    expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument()
  })

  it('displays "Status not found" for unknown statuses', () => {
    const mockTransactionHistoryWithUnknownStatus = [
      {
        createDate: '2023-05-03',
        adminAdjustmentStatus: null,
        initiativeAgreementStatus: null,
        userProfile: { firstName: 'Alice', lastName: 'Johnson' }
      }
    ]

    renderComponent({ transactionHistory: mockTransactionHistoryWithUnknownStatus })

    expect(screen.getByText(/Status not found/i)).toBeInTheDocument()
  })

  it('handles empty transaction history gracefully', () => {
    renderComponent({ transactionHistory: [] })

    expect(screen.queryByText('Transaction History')).not.toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})
