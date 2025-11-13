import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import OrgTransactionsCard from '../OrgTransactionsCard'

// Mock all hooks
vi.mock('@/hooks/useOrganization')
vi.mock('@/hooks/useDashboard')

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      const translations = {
        'dashboard:orgTransactions.title': 'Organization Transactions',
        'dashboard:orgTransactions.loadingMessage': 'Loading transactions...',
        'dashboard:orgTransactions.orgHas': `${options?.name || 'Organization'} has`,
        'dashboard:orgTransactions.transfersInProgress':
          'transfers in progress',
        'dashboard:orgTransactions.organizationsRegistered':
          'Credit trading market',
        'dashboard:orgTransactions.startNewTransfer': 'Start new transfer'
      }
      return translations[key] || key
    }
  })
}))

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

// Mock Material-UI components
vi.mock('@mui/material', () => ({
  Stack: ({ children, ...props }) => (
    <div data-test="stack" {...props}>
      {children}
    </div>
  ),
  List: ({ children, ...props }) => (
    <div data-test="list" {...props}>
      {children}
    </div>
  ),
  ListItemButton: ({ children, onClick, ...props }) => (
    <div data-test="list-item-button" onClick={onClick} {...props}>
      {children}
    </div>
  )
}))

// Mock custom components
vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  default: ({ title, content, ...props }) => (
    <div data-test="bc-widget-card" {...props}>
      <div data-test="widget-title">{title}</div>
      <div data-test="widget-content">{content}</div>
    </div>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, onClick, title, ...props }) => (
    <div data-test="bc-typography" onClick={onClick} title={title} {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/Loading', () => ({
  default: ({ message }) => <div data-test="loading">{message}</div>
}))

// Mock FontAwesome
// Mock withRole HOC
vi.mock('@/utils/withRole', () => ({
  default: (Component) => Component
}))

// Mock constants
vi.mock('@/routes/routes', () => ({
  ROUTES: {
    TRANSACTIONS: { LIST: '/transactions' },
    TRANSFERS: { ADD: '/transfers/add' }
  }
}))

vi.mock('@/constants/common', () => ({
  FILTER_KEYS: {
    TRANSACTIONS_GRID: 'transactions_grid'
  }
}))

vi.mock('@/constants/statuses', () => ({
  TRANSFER_STATUSES: {
    SENT: 'sent',
    SUBMITTED: 'submitted',
    RECOMMENDED: 'recommended'
  },
  TRANSACTION_TYPES: {
    TRANSFER: 'transfer'
  }
}))

// Mock global objects
Object.defineProperty(window, 'sessionStorage', {
  value: {
    setItem: vi.fn()
  },
  writable: true
})

describe('OrgTransactionsCard', () => {
  let useOrganization, useOrgTransactionCounts

  beforeAll(async () => {
    const orgModule = await import('@/hooks/useOrganization')
    const dashboardModule = await import('@/hooks/useDashboard')
    useOrganization = orgModule.useOrganization
    useOrgTransactionCounts = dashboardModule.useOrgTransactionCounts
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    window.sessionStorage.setItem.mockClear()
  })

  describe('CountDisplay component', () => {
    it('shows count when count is provided', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Org' } })
      useOrgTransactionCounts.mockReturnValue({
        data: { transfers: 5 },
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('shows 0 when count is 0', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Org' } })
      useOrgTransactionCounts.mockReturnValue({
        data: { transfers: 0 },
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      expect(screen.getAllByText('0')).toHaveLength(3)
    })

    it('shows 0 when count is null', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Org' } })
      useOrgTransactionCounts.mockReturnValue({
        data: null,
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      expect(screen.getAllByText('0')).toHaveLength(3)
    })
  })

  describe('Loading state', () => {
    it('displays loading state when data is loading', () => {
      useOrganization.mockReturnValue({ data: null })
      useOrgTransactionCounts.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(<OrgTransactionsCard />)

      expect(screen.getByText('Loading transactions...')).toBeInTheDocument()
    })
  })

  describe('Loaded state', () => {
    it('displays organization name and transactions', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Organization' } })
      useOrgTransactionCounts.mockReturnValue({
        data: { transfers: 3 },
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      expect(screen.getByText('Test Organization has')).toBeInTheDocument()
      expect(screen.getByText('transfers in progress')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('displays card title', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Org' } })
      useOrgTransactionCounts.mockReturnValue({
        data: { transfers: 1 },
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      expect(screen.getByText('Organization Transactions')).toBeInTheDocument()
    })
  })

  describe('handleNavigation function', () => {
    it('sets sessionStorage and navigates when handleNavigation is called', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Org' } })
      useOrgTransactionCounts.mockReturnValue({
        data: { transfers: 2 },
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      const transfersButton = screen.getAllByTestId('list-item-button')[0]
      fireEvent.click(transfersButton)

      expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
        'transactions_grid',
        JSON.stringify({
          status: {
            filterType: 'set',
            type: 'set',
            filter: ['sent', 'submitted', 'recommended']
          },
          transactionType: {
            filterType: 'text',
            type: 'equals',
            filter: 'transfer'
          }
        })
      )
      expect(mockNavigate).toHaveBeenCalledWith('/transactions')
    })
  })

  describe('credit trading market link', () => {
    it('navigates to credit trading market tab within the app', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Org' } })
      useOrgTransactionCounts.mockReturnValue({
        data: { transfers: 1 },
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      const creditMarketButton = screen.getAllByTestId('list-item-button')[1]
      fireEvent.click(creditMarketButton)

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/transactions',
        search: '?tab=credit-trading-market'
      })
    })
  })

  describe('Link interactions', () => {
    it('handles transfers in progress link click', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Org' } })
      useOrgTransactionCounts.mockReturnValue({
        data: { transfers: 4 },
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      const transfersLink = screen.getAllByTestId('list-item-button')[0]
      fireEvent.click(transfersLink)

      expect(mockNavigate).toHaveBeenCalledWith('/transactions')
    })

    it('displays credit trading market link text', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Org' } })
      useOrgTransactionCounts.mockReturnValue({
        data: { transfers: 1 },
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      expect(screen.getByText('Credit trading market')).toBeInTheDocument()
    })

    it('handles start new transfer link click', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Org' } })
      useOrgTransactionCounts.mockReturnValue({
        data: { transfers: 1 },
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      const newTransferButton = screen.getAllByTestId('list-item-button')[2]
      fireEvent.click(newTransferButton)

      expect(mockNavigate).toHaveBeenCalledWith('/transfers/add')
    })
  })

  describe('renderLinkWithCount function', () => {
    it('renders count and link text', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Org' } })
      useOrgTransactionCounts.mockReturnValue({
        data: { transfers: 7 },
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.getByText('transfers in progress')).toBeInTheDocument()
      expect(screen.getByText('Credit trading market')).toBeInTheDocument()
      expect(screen.getByText('Start new transfer')).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('handles null organization data', () => {
      useOrganization.mockReturnValue({ data: null })
      useOrgTransactionCounts.mockReturnValue({
        data: { transfers: 2 },
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      expect(screen.getByText('Organization has')).toBeInTheDocument()
    })

    it('handles undefined transfers count', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Org' } })
      useOrgTransactionCounts.mockReturnValue({
        data: { transfers: undefined },
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      expect(screen.getAllByText('0')).toHaveLength(3)
    })

    it('handles empty counts data', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Org' } })
      useOrgTransactionCounts.mockReturnValue({
        data: {},
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      expect(screen.getAllByText('0')).toHaveLength(3)
    })
  })

  describe('withRole HOC integration', () => {
    it('renders component with role restrictions applied', () => {
      useOrganization.mockReturnValue({ data: { name: 'Test Org' } })
      useOrgTransactionCounts.mockReturnValue({
        data: { transfers: 1 },
        isLoading: false
      })

      render(<OrgTransactionsCard />)

      expect(screen.getByTestId('bc-widget-card')).toBeInTheDocument()
    })
  })
})
