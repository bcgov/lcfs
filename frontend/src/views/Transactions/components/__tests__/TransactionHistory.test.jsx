import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionHistory } from '../TransactionHistory'
// import { useTranslation } from 'react-i18next'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.extend(localizedFormat)

// Mock the translation function
// vi.mock('react-i18next', () => ({
//   useTranslation: () => ({
//     t: vi.fn((key, fallback) => fallback || key)
//   })
// }))

const renderComponent = (props) => {
  return render(
    <ThemeProvider theme={theme}>
      <TransactionHistory {...props} />
    </ThemeProvider>
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
    renderComponent({ transactionHistory: [] })
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

    expect(screen.queryByText('Transaction History')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})
