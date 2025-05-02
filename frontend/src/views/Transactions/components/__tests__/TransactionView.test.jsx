import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionView } from '../TransactionView'
import { useTranslation } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock the translation function
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: vi.fn((key) => key)
  })
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn()
  })
}))

const renderComponent = (props) => {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <TransactionView {...props} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('TransactionView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockTransaction = {
    adminAdjustmentId: 123,
    toOrganization: { name: 'Test Organization' },
    complianceUnits: '1000',
    transactionEffectiveDate: '2023-05-01',
    govComment: 'Test comment'
  }

  it('renders without crashing', () => {
    renderComponent({ transaction: mockTransaction })
    expect(
      screen.getByText(/txn:administrativeAdjustment/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/Test Organization/i)).toBeInTheDocument()
  })

  it('displays transaction details correctly', () => {
    renderComponent({ transaction: mockTransaction })

    expect(
      screen.getByText(/txn:administrativeAdjustment/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/txn:complianceUnitsLabel/i)).toBeInTheDocument()
    expect(screen.getByText(/1,000/i)).toBeInTheDocument()
    expect(screen.getByText(/txn:effectiveDateLabel/i)).toBeInTheDocument()
    expect(screen.getByText(/2023-05-01/i)).toBeInTheDocument()
    expect(screen.getByText(/txn:comments/i)).toBeInTheDocument()
    expect(screen.getByText(/Test comment/i)).toBeInTheDocument()
  })

  it('displays "unknown" for missing organization name', () => {
    const transactionWithoutOrg = {
      ...mockTransaction,
      toOrganization: null
    }

    renderComponent({ transaction: transactionWithoutOrg })

    expect(
      screen.getByText(/txn:administrativeAdjustment/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/common:unknown/i)).toBeInTheDocument()
  })

  it('displays initiative agreement if adminAdjustmentId is missing', () => {
    const transactionWithInitiative = {
      ...mockTransaction,
      adminAdjustmentId: null
    }

    renderComponent({ transaction: transactionWithInitiative })

    expect(
      screen.getByText(/txn:initiativeAgreement for Test Organization/i)
    ).toBeInTheDocument()
  })
})
