import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionHistory } from '../TransactionHistory'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock all external dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: vi.fn((key, fallback) => {
      if (key === 'txn:txnHistoryLabel') return 'Transaction History'
      if (key === 'govOrg') return 'Government Organization'
      if (key.includes('txn:txnHistory.')) {
        const status = key.split('.').pop()
        if (status === 'Approved') return 'Approved'
        if (status === 'Recommended') return 'Recommended'
        if (status === 'Draft') return 'Draft'
        return fallback || 'Status not found'
      }
      return fallback || key
    })
  })
}))

vi.mock('@/utils/formatters.js', () => ({
  formatDateWithTimezoneAbbr: vi.fn((date) => `Formatted: ${date}`)
}))

vi.mock('dayjs', () => {
  const mockDayjs = vi.fn()
  mockDayjs.extend = vi.fn()
  return { default: mockDayjs, __esModule: true }
})

vi.mock('dayjs/plugin/localizedFormat', () => ({
  default: {}
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => <div data-test="bc-box" {...props}>{children}</div>
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => <div data-test="bc-typography" {...props}>{children}</div>
}))

const renderComponent = (props = {}) => {
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

  // Test empty transaction history (early return cases)
  describe('Empty transaction history handling', () => {
    it('renders empty fragment when transactionHistory is empty array', () => {
      renderComponent({ transactionHistory: [] })
      expect(screen.queryByText('Transaction History')).not.toBeInTheDocument()
    })

    it('renders empty fragment when transactionHistory length is 0', () => {
      renderComponent({ transactionHistory: [] })
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
    })

    it('renders component when transactionHistory is null', () => {
      renderComponent({ transactionHistory: null })
      expect(screen.getByText('Transaction History')).toBeInTheDocument()
    })

    it('renders component when transactionHistory is undefined', () => {
      renderComponent({ transactionHistory: undefined })
      expect(screen.getByText('Transaction History')).toBeInTheDocument()
    })
  })

  // Test main rendering with different status types
  describe('Transaction history rendering', () => {
    it('renders transaction history with adminAdjustmentStatus', () => {
      const mockHistory = [{
        createDate: '2023-05-01',
        adminAdjustmentStatus: { status: 'Approved' },
        initiativeAgreementStatus: null,
        userProfile: { firstName: 'John', lastName: 'Doe' }
      }]
      
      renderComponent({ transactionHistory: mockHistory })
      
      expect(screen.getByText('Transaction History')).toBeInTheDocument()
      expect(screen.getByText('Approved')).toBeInTheDocument()
      expect(screen.getByText('Formatted: 2023-05-01')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Government Organization')).toBeInTheDocument()
    })

    it('renders transaction history with initiativeAgreementStatus when adminAdjustmentStatus is null', () => {
      const mockHistory = [{
        createDate: '2023-05-02',
        adminAdjustmentStatus: null,
        initiativeAgreementStatus: { status: 'Recommended' },
        userProfile: { firstName: 'Jane', lastName: 'Smith' }
      }]
      
      renderComponent({ transactionHistory: mockHistory })
      
      expect(screen.getByText('Recommended')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    it('renders fallback status when both status objects are null', () => {
      const mockHistory = [{
        createDate: '2023-05-03',
        adminAdjustmentStatus: null,
        initiativeAgreementStatus: null,
        userProfile: { firstName: 'Alice', lastName: 'Johnson' }
      }]
      
      renderComponent({ transactionHistory: mockHistory })
      
      expect(screen.getByText('Status not found')).toBeInTheDocument()
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    })
  })

  // Test displayName vs firstName/lastName branches
  describe('User name display logic', () => {
    it('renders displayName when present', () => {
      const mockHistory = [{
        createDate: '2023-05-01',
        adminAdjustmentStatus: { status: 'Draft' },
        displayName: 'Custom Display Name',
        userProfile: { firstName: 'John', lastName: 'Doe' }
      }]
      
      renderComponent({ transactionHistory: mockHistory })
      
      expect(screen.getByText('Custom Display Name')).toBeInTheDocument()
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    })

    it('renders firstName lastName when displayName is absent', () => {
      const mockHistory = [{
        createDate: '2023-05-01',
        adminAdjustmentStatus: { status: 'Draft' },
        displayName: null,
        userProfile: { firstName: 'John', lastName: 'Doe' }
      }]
      
      renderComponent({ transactionHistory: mockHistory })
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.queryByText('Custom Display Name')).not.toBeInTheDocument()
    })

    it('renders firstName lastName when displayName is undefined', () => {
      const mockHistory = [{
        createDate: '2023-05-01',
        adminAdjustmentStatus: { status: 'Draft' },
        userProfile: { firstName: 'John', lastName: 'Doe' }
      }]
      
      renderComponent({ transactionHistory: mockHistory })
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
  })

  // Test multiple items rendering
  describe('Multiple transaction items', () => {
    it('renders multiple transaction history items', () => {
      const mockHistory = [
        {
          createDate: '2023-05-01',
          adminAdjustmentStatus: { status: 'Approved' },
          userProfile: { firstName: 'John', lastName: 'Doe' }
        },
        {
          createDate: '2023-05-02',
          initiativeAgreementStatus: { status: 'Recommended' },
          userProfile: { firstName: 'Jane', lastName: 'Smith' }
        }
      ]
      
      renderComponent({ transactionHistory: mockHistory })
      
      expect(screen.getByText('Approved')).toBeInTheDocument()
      expect(screen.getByText('Recommended')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
  })

  // Test component structure
  describe('Component structure', () => {
    it('renders correct HTML structure with list elements', () => {
      const mockHistory = [{
        createDate: '2023-05-01',
        adminAdjustmentStatus: { status: 'Approved' },
        userProfile: { firstName: 'John', lastName: 'Doe' }
      }]
      
      renderComponent({ transactionHistory: mockHistory })
      
      const listElements = screen.getAllByRole('listitem')
      expect(listElements).toHaveLength(1)
      expect(screen.getByRole('list')).toBeInTheDocument()
    })

    it('applies correct styling and structure', () => {
      const mockHistory = [{
        createDate: '2023-05-01',
        adminAdjustmentStatus: { status: 'Approved' },
        userProfile: { firstName: 'John', lastName: 'Doe' }
      }]
      
      renderComponent({ transactionHistory: mockHistory })
      
      expect(screen.getByText('Transaction History')).toBeInTheDocument()
      expect(screen.getAllByText('on').length).toBeGreaterThan(0)
      expect(screen.getAllByText('by').length).toBeGreaterThan(0)
      expect(screen.getAllByText('of').length).toBeGreaterThan(0)
    })
  })
})