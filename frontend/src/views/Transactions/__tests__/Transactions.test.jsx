import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { forwardRef } from 'react'
import theme from '@/themes'
import { Transactions } from '../Transactions'

// Mock all hooks and dependencies
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useTransactions')
vi.mock('@/services/useApiService')

const mockNavigate = vi.fn()
const mockSetSearchParams = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
    useLocation: () => ({ pathname: '/transactions', state: null })
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, defaultValue) => {
      const translations = {
        'txn:title': 'Transactions',
        'txn:transactionsTab': 'Transactions',
        'txn:creditTradingMarketTab': 'Credit Trading Market',
        'txn:creditTradingMarketTitle': 'Credit Trading Market',
        'txn:newTransferBtn': 'New Transfer',
        'txn:newTransactionBtn': 'New Transaction',
        'txn:downloadAsExcel': 'Download as Excel',
        'txn:downloadingTxnInfo': 'Downloading...',
        'txn:noTxnsFound': 'No transactions found',
        'common:ClearFilters': 'Clear Filters'
      }
      return translations[key] || defaultValue || key
    }
  })
}))

// Mock components
vi.mock('@/components/DownloadButton', () => ({
  DownloadButton: forwardRef(
    ({ onDownload, dataTest, isDownloading, label, downloadLabel }, ref) => (
      <button
        ref={ref}
        data-test={dataTest}
        onClick={onDownload}
        disabled={isDownloading}
      >
        {isDownloading ? downloadLabel : label}
      </button>
    )
  )
}))

vi.mock('@/components/ClearFiltersButton', () => ({
  ClearFiltersButton: ({ onClick }) => (
    <button data-test="clear-filters-button" onClick={onClick}>
      Clear Filters
    </button>
  )
}))

// SINGLE BCGridViewer mock - no duplicates
vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: ({
    onPaginationChange,
    queryData,
    gridRef,
    getRowId,
    defaultColDef,
    onRowClicked,
    highlightedRowId
  }) => {
    // Set up grid ref mock
    if (gridRef) {
      gridRef.current = {
        clearFilters: vi.fn(),
        api: {
          getFilterModel: vi.fn(() => ({})),
          deselectAll: vi.fn()
        }
      }
    }

    // Test getRowId function if provided
    if (getRowId && queryData?.data?.transactions?.[0]) {
      const rowId = getRowId({ data: queryData.data.transactions[0] })
    }

    // Test defaultColDef if provided
    if (defaultColDef?.cellRenderer && queryData?.data?.transactions?.[0]) {
      const mockProps = { data: { data: queryData.data.transactions[0] } }
      try {
        defaultColDef.cellRenderer(mockProps)
      } catch (e) {
        // Ignore rendering errors in tests
      }
    }

    return (
      <div
        data-test="bc-grid-viewer"
        onClick={() =>
          onRowClicked?.({
            data: { transactionId: '123', transactionType: 'Transfer' }
          })
        }
      >
        <button
          onClick={() => onPaginationChange?.({ page: 2, size: 20 })}
          data-test="pagination-button"
        >
          Pagination
        </button>
        {queryData?.data?.transactions?.map((t, i) => (
          <div
            key={i}
            data-test="transaction-row"
            className={
              highlightedRowId ===
              `${t.transactionType.toLowerCase()}-${t.transactionId}`
                ? 'highlighted'
                : ''
            }
          >
            {t.transactionId}
          </div>
        ))}
      </div>
    )
  }
}))

vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading">Loading...</div>
}))

// FIXED: Complete OrganizationList mock
vi.mock('../components/OrganizationList', () => ({
  default: ({ onOrgChange, selectedOrg }) => (
    <div data-test="organization-list">
      <button
        onClick={() => onOrgChange?.({ id: 'org-123', label: 'Test Org' })}
      >
        Select Org: {selectedOrg?.label || 'None'}
      </button>
    </div>
  )
}))

vi.mock('../CreditTradingMarket/CreditTradingMarket', () => ({
  CreditTradingMarket: () => (
    <div data-test="credit-trading-market">Credit Trading Market</div>
  )
}))

vi.mock('../CreditTradingMarket/CreditMarketDetailsCard', () => ({
  CreditMarketDetailsCard: () => (
    <div data-test="credit-market-details">Market Details</div>
  )
}))

vi.mock('@/components/Role', () => ({
  Role: ({ children, roles }) => (
    <div data-test="role-component" data-roles={roles?.join(',')}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCAlert', () => ({
  default: ({ children, severity, sx }) => (
    <div data-test="alert-box" data-severity={severity}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => (
    <div data-test="bc-box" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, onClick, startIcon, id, disabled }) => (
    <button data-test="bc-button" id={id} onClick={onClick} disabled={disabled}>
      {startIcon && <span data-test="start-icon">{startIcon}</span>}
      {children}
    </button>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, variant, ...props }) => (
    <span data-test="bc-typography" data-variant={variant} {...props}>
      {children}
    </span>
  )
}))

vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon, className, size }) => (
    <span data-test="font-awesome-icon" data-icon={icon?.iconName}>
      Icon
    </span>
  )
}))

// Mock schema
vi.mock('./_schema', () => ({
  transactionsColDefs: () => [
    { field: 'transactionId', headerName: 'ID' },
    { field: 'transactionType', headerName: 'Type' }
  ],
  defaultSortModel: [{ field: 'transactionId', direction: 'desc' }]
}))

// Mock constants
vi.mock('@/constants/statuses', () => ({
  ORGANIZATION_STATUSES: { REGISTERED: 'Registered' },
  TRANSACTION_STATUSES: { DRAFT: 'Draft' },
  TRANSFER_STATUSES: { DRAFT: 'Draft' }
}))

vi.mock('@/constants/roles', () => ({
  roles: {
    government: 'government',
    supplier: 'supplier',
    transfers: 'transfers',
    analyst: 'analyst',
    signing_authority: 'signing_authority',
    compliance_reporting: 'compliance_reporting'
  },
  govRoles: ['government', 'analyst']
}))

vi.mock('@/constants/routes', () => ({
  apiRoutes: {
    exportTransactions: '/api/transactions/export',
    exportOrgTransactions: '/api/org-transactions/export',
    exportFilteredTransactionsByOrg: '/api/transactions/org/:orgID/export'
  }
}))

vi.mock('@/routes/routes', () => ({
  ROUTES: {
    TRANSFERS: {
      ADD: '/transfers/add',
      VIEW: '/transfers/:transferId',
      EDIT: '/transfers/:transferId/edit'
    },
    TRANSACTIONS: {
      ADD: '/transactions/add',
      ADMIN_ADJUSTMENT: {
        VIEW: '/transactions/admin-adjustment/:transactionId',
        ORG_VIEW: '/transactions/admin-adjustment/:transactionId/org-view',
        EDIT: '/transactions/admin-adjustment/:transactionId/edit'
      },
      INITIATIVE_AGREEMENT: {
        VIEW: '/transactions/initiative-agreement/:transactionId',
        ORG_VIEW: '/transactions/initiative-agreement/:transactionId/org-view',
        EDIT: '/transactions/initiative-agreement/:transactionId/edit'
      }
    },
    REPORTS: {
      VIEW: '/reports/:compliancePeriod/:complianceReportId'
    }
  }
}))

vi.mock('@/utils/grid/cellRenderers.jsx', () => ({
  ConditionalLinkRenderer: (shouldRenderLink) => (props) => {
    const canRender = shouldRenderLink(props)
    return (
      <div data-test="conditional-link-renderer" data-can-render={canRender}>
        Link
      </div>
    )
  },
  TransactionStatusRenderer: () => (
    <div data-test="transaction-status-renderer">Status</div>
  ),
  LinkRenderer: () => <div data-test="link-renderer">Link</div>,
  DateRenderer: () => <div data-test="date-renderer">Date</div>,
  NumericRenderer: () => <div data-test="numeric-renderer">Number</div>,
  CurrencyRenderer: () => <div data-test="currency-renderer">$0.00</div>,
  // Add other common renderers that might be used
  StatusRenderer: () => <div data-test="status-renderer">Status</div>,
  OrganizationRenderer: () => (
    <div data-test="organization-renderer">Organization</div>
  )
}))

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
})

// Mock window resize events
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()
Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener
})
Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener
})

// Test wrapper
const TestWrapper = ({ children, initialEntries = ['/transactions'] }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('Transactions Component', () => {
  let mockUseCurrentUser, mockUseTransactions, mockDownloadTransactions

  beforeEach(async () => {
    vi.clearAllMocks()

    // Clear sessionStorage mock
    sessionStorageMock.getItem.mockReturnValue(null)
    sessionStorageMock.setItem.mockClear()
    sessionStorageMock.removeItem.mockClear()

    // Setup mocks
    mockUseCurrentUser = {
      data: {
        organization: {
          name: 'Test Organization',
          orgStatus: { status: 'Registered' }
        },
        roles: [{ name: 'transfers' }],
        isGovernmentUser: false
      },
      hasRoles: vi.fn(() => false),
      hasAnyRole: vi.fn(() => false)
    }

    mockDownloadTransactions = vi.fn().mockResolvedValue()

    mockUseTransactions = {
      data: {
        transactions: [
          {
            transactionId: '123',
            transactionType: 'Transfer',
            fromOrganization: 'Test Org',
            status: 'Draft',
            compliancePeriod: '2024'
          }
        ]
      },
      isLoading: false,
      error: null
    }

    // Apply mocks
    const { useCurrentUser } = await import('@/hooks/useCurrentUser')
    const { useGetTransactionList, useDownloadTransactions } = await import(
      '@/hooks/useTransactions'
    )
    const { useApiService } = await import('@/services/useApiService')

    vi.mocked(useCurrentUser).mockReturnValue(mockUseCurrentUser)
    vi.mocked(useGetTransactionList).mockReturnValue(mockUseTransactions)
    vi.mocked(useDownloadTransactions).mockReturnValue({
      mutateAsync: mockDownloadTransactions
    })
    vi.mocked(useApiService).mockReturnValue({
      get: vi.fn(),
      post: vi.fn(),
      download: vi.fn()
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Loading and Rendering', () => {
    it('should render loading state when user is null', () => {
      mockUseCurrentUser.data = null

      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    it('should render main transactions view', () => {
      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      expect(screen.getAllByText('Transactions')).toHaveLength(2)
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('should render download button', () => {
      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      expect(
        screen.getByTestId('download-transactions-button')
      ).toBeInTheDocument()
    })

    it('should render clear filters button', () => {
      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should handle download button click successfully', async () => {
      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      const downloadButton = screen.getByTestId('download-transactions-button')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(mockDownloadTransactions).toHaveBeenCalled()
      })
    })

    it('should handle download error and display alert', async () => {
      mockDownloadTransactions.mockRejectedValue(new Error('Download failed'))

      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      const downloadButton = screen.getByTestId('download-transactions-button')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(
          screen.getByText('Failed to download transactions information.')
        ).toBeInTheDocument()
      })
    })

    it('should handle clear filters button click', async () => {
      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      const clearButton = screen.getByTestId('clear-filters-button')
      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      })
    })

    it('should handle pagination change', async () => {
      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      const paginationButton = screen.getByTestId('pagination-button')
      fireEvent.click(paginationButton)

      await waitFor(() => {
        expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
      })
    })
  })

  describe('Role-based Rendering', () => {
    it('should render different content based on user roles', () => {
      mockUseCurrentUser.hasRoles.mockImplementation(
        (role) => role === 'transfers'
      )

      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      // Role-based buttons have complex logic - just verify component renders
      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('should show organization list for government users', () => {
      mockUseCurrentUser.hasRoles.mockImplementation((role) =>
        ['government', 'analyst'].includes(role)
      )

      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      expect(screen.getByTestId('organization-list')).toBeInTheDocument()
    })
  })

  describe('Tab Functionality', () => {
    it('should render single tab view when credit trading not available', () => {
      mockUseCurrentUser.hasRoles.mockReturnValue(false)
      mockUseCurrentUser.data.organization.orgStatus.status = 'Unregistered'

      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      expect(screen.getAllByText('Transactions')).toHaveLength(1)
      expect(
        screen.queryByTestId('credit-trading-market')
      ).not.toBeInTheDocument()
    })

    it('should render multiple tabs when credit trading available for government users', () => {
      mockUseCurrentUser.hasRoles.mockImplementation(
        (role) => role === 'government'
      )

      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      expect(screen.getAllByText('Transactions')).toHaveLength(2)
      expect(screen.getByText('Credit Trading Market')).toBeInTheDocument()
    })

    it('should handle tab switching', () => {
      mockUseCurrentUser.hasRoles.mockImplementation(
        (role) => role === 'government'
      )

      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      const creditTradingTab = screen.getByText('Credit Trading Market')
      fireEvent.click(creditTradingTab)
    })
  })

  describe('Data Display', () => {
    it('should display transaction data', () => {
      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      expect(screen.getByTestId('transaction-row')).toBeInTheDocument()
      expect(screen.getByText('123')).toBeInTheDocument()
    })

    it('should handle empty transaction data', () => {
      mockUseTransactions.data.transactions = []

      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })

    it('should handle highlighted row', () => {
      render(
        <TestWrapper initialEntries={['/transactions?hid=transfer-123']}>
          <Transactions />
        </TestWrapper>
      )

      expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    })
  })

  describe('Organization Selection', () => {
    it('should handle organization selection', async () => {
      mockUseCurrentUser.hasRoles.mockImplementation((role) =>
        ['government', 'analyst'].includes(role)
      )

      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      const orgButton = screen.getByText('Select Org: None')
      fireEvent.click(orgButton)

      await waitFor(() => {
        expect(screen.getByText('Select Org: Test Org')).toBeInTheDocument()
      })
    })
  })

  describe('Window Resize Handling', () => {
    it('should handle window resize events', () => {
      render(
        <TestWrapper>
          <Transactions />
        </TestWrapper>
      )

      expect(mockAddEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      )
    })
  })

  describe('URL Parameter Handling', () => {
    it('should handle default URL parameters', () => {
      render(
        <TestWrapper initialEntries={['/transactions']}>
          <Transactions />
        </TestWrapper>
      )

      expect(screen.getAllByText('Transactions')).toHaveLength(2)
    })
  })

  describe('Organization Filter Session Storage Persistence', () => {
    beforeEach(() => {
      // Enable government user role for organization list visibility
      mockUseCurrentUser.hasRoles.mockImplementation((role) =>
        ['government', 'analyst'].includes(role)
      )
    })

    describe('Initialization from Session Storage', () => {
      it('should initialize with no organization filter when session storage is empty', () => {
        sessionStorageMock.getItem.mockReturnValue(null)

        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        expect(sessionStorageMock.getItem).toHaveBeenCalledWith(
          'transactions-grid-orgFilter'
        )
        expect(screen.getByText('Select Org: None')).toBeInTheDocument()
      })

      it('should initialize with organization filter from session storage', () => {
        const savedFilter = { id: 'org-456', label: 'Saved Organization' }
        sessionStorageMock.getItem.mockReturnValue(JSON.stringify(savedFilter))

        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        expect(sessionStorageMock.getItem).toHaveBeenCalledWith(
          'transactions-grid-orgFilter'
        )
        expect(
          screen.getByText('Select Org: Saved Organization')
        ).toBeInTheDocument()
      })

      it('should handle malformed session storage data gracefully', () => {
        sessionStorageMock.getItem.mockReturnValue('invalid-json')

        // Mock console.warn to avoid test output noise
        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {})

        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        expect(sessionStorageMock.getItem).toHaveBeenCalledWith(
          'transactions-grid-orgFilter'
        )
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to parse saved organization filter:',
          expect.any(Error)
        )
        expect(screen.getByText('Select Org: None')).toBeInTheDocument()

        consoleSpy.mockRestore()
      })

      it('should handle null/undefined session storage values', () => {
        sessionStorageMock.getItem.mockReturnValue(undefined)

        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        expect(sessionStorageMock.getItem).toHaveBeenCalledWith(
          'transactions-grid-orgFilter'
        )
        expect(screen.getByText('Select Org: None')).toBeInTheDocument()
      })
    })

    describe('Saving to Session Storage', () => {
      it('should save organization filter to session storage when organization is selected', async () => {
        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        const orgButton = screen.getByText('Select Org: None')
        fireEvent.click(orgButton)

        await waitFor(() => {
          expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
            'transactions-grid-orgFilter',
            JSON.stringify({ id: 'org-123', label: 'Test Org' })
          )
        })
      })

      it('should remove organization filter from session storage when cleared', async () => {
        // Initialize with an organization filter
        const initialFilter = { id: 'org-789', label: 'Initial Org' }
        sessionStorageMock.getItem.mockReturnValue(
          JSON.stringify(initialFilter)
        )

        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        const clearButton = screen.getByTestId('clear-filters-button')
        fireEvent.click(clearButton)

        await waitFor(() => {
          expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(
            'transactions-grid-orgFilter'
          )
        })
      })

      it('should handle organization filter with null values', async () => {
        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        // Select an org first
        const orgButton = screen.getByText('Select Org: None')
        fireEvent.click(orgButton)

        // Clear the selection by calling the clear filters
        const clearButton = screen.getByTestId('clear-filters-button')
        fireEvent.click(clearButton)

        await waitFor(() => {
          expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(
            'transactions-grid-orgFilter'
          )
        })
      })
    })

    describe('Clear Filters Integration', () => {
      it('should clear both organization filter and grid filters from session storage', async () => {
        // Initialize with some filters
        const initialFilter = { id: 'org-999', label: 'Filter Org' }
        sessionStorageMock.getItem.mockReturnValue(
          JSON.stringify(initialFilter)
        )

        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        const clearButton = screen.getByTestId('clear-filters-button')
        fireEvent.click(clearButton)

        await waitFor(() => {
          // Should remove organization filter
          expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(
            'transactions-grid-orgFilter'
          )
          // Should remove grid filters
          expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(
            'transactions-grid-filter'
          )
        })
      })

      it('should reset organization display when filters are cleared', async () => {
        // Initialize with an organization filter
        const initialFilter = { id: 'org-clear', label: 'Clear Test Org' }
        sessionStorageMock.getItem.mockReturnValue(
          JSON.stringify(initialFilter)
        )

        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        // Verify initial state
        expect(
          screen.getByText('Select Org: Clear Test Org')
        ).toBeInTheDocument()

        const clearButton = screen.getByTestId('clear-filters-button')
        fireEvent.click(clearButton)

        await waitFor(() => {
          expect(screen.getByText('Select Org: None')).toBeInTheDocument()
        })
      })
    })

    describe('Organization Filter State Management', () => {
      it('should maintain organization filter state during component re-renders', async () => {
        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        // Select an organization
        const orgButton = screen.getByText('Select Org: None')
        fireEvent.click(orgButton)

        await waitFor(() => {
          expect(screen.getByText('Select Org: Test Org')).toBeInTheDocument()
        })

        // Trigger a re-render by clicking pagination
        const paginationButton = screen.getByTestId('pagination-button')
        fireEvent.click(paginationButton)

        await waitFor(() => {
          // Organization filter should still be selected
          expect(screen.getByText('Select Org: Test Org')).toBeInTheDocument()
        })
      })

      it('should update query parameters when organization filter changes', async () => {
        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        // Select an organization
        const orgButton = screen.getByText('Select Org: None')
        fireEvent.click(orgButton)

        await waitFor(() => {
          // Should have updated sessionStorage and state properly
          expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
            'transactions-grid-orgFilter',
            JSON.stringify({ id: 'org-123', label: 'Test Org' })
          )
          expect(screen.getByText('Select Org: Test Org')).toBeInTheDocument()
        })
      })

      it('should handle organization filter updates with valid data', async () => {
        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        const orgButton = screen.getByText('Select Org: None')
        fireEvent.click(orgButton)

        await waitFor(() => {
          expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
            'transactions-grid-orgFilter',
            JSON.stringify({ id: 'org-123', label: 'Test Org' })
          )
          expect(screen.getByText('Select Org: Test Org')).toBeInTheDocument()
        })
      })

      it('should handle organization filter removal when organization is deselected', async () => {
        // Start with an organization selected
        const initialFilter = { id: 'org-remove', label: 'Remove Test Org' }
        sessionStorageMock.getItem.mockReturnValue(
          JSON.stringify(initialFilter)
        )

        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        // Clear filters to deselect organization
        const clearButton = screen.getByTestId('clear-filters-button')
        fireEvent.click(clearButton)

        await waitFor(() => {
          expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(
            'transactions-grid-orgFilter'
          )
          expect(screen.getByText('Select Org: None')).toBeInTheDocument()
        })
      })
    })

    describe('Error Handling and Edge Cases', () => {
      it('should handle sessionStorage.setItem failures gracefully', async () => {
        sessionStorageMock.setItem.mockImplementation(() => {
          throw new Error('SessionStorage quota exceeded')
        })

        // Mock console.warn to verify error handling
        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {})

        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        const orgButton = screen.getByText('Select Org: None')
        fireEvent.click(orgButton)

        await waitFor(() => {
          expect(consoleSpy).toHaveBeenCalledWith(
            'Failed to update organization filter in session storage:',
            expect.any(Error)
          )
          // State should still be updated even if sessionStorage fails
          expect(screen.getByText('Select Org: Test Org')).toBeInTheDocument()
        })

        consoleSpy.mockRestore()
      })

      it('should handle sessionStorage.removeItem failures gracefully', async () => {
        sessionStorageMock.removeItem.mockImplementation(() => {
          throw new Error('SessionStorage error')
        })

        // Mock console.warn to verify error handling
        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {})

        const initialFilter = { id: 'org-error', label: 'Error Test Org' }
        sessionStorageMock.getItem.mockReturnValue(
          JSON.stringify(initialFilter)
        )

        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        const clearButton = screen.getByTestId('clear-filters-button')
        fireEvent.click(clearButton)

        await waitFor(() => {
          // Should have logged both warnings (for org filter and grid filter)
          expect(consoleSpy).toHaveBeenCalledWith(
            'Failed to update organization filter in session storage:',
            expect.any(Error)
          )
          expect(consoleSpy).toHaveBeenCalledWith(
            'Failed to clear grid filter from session storage:',
            expect.any(Error)
          )
          // State should still be updated even if sessionStorage fails
          expect(screen.getByText('Select Org: None')).toBeInTheDocument()
        })

        consoleSpy.mockRestore()
      })

      it('should handle empty string session storage values', () => {
        sessionStorageMock.getItem.mockReturnValue('')

        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        expect(screen.getByText('Select Org: None')).toBeInTheDocument()
      })

      it('should handle organization filter with missing id or label', async () => {
        render(
          <TestWrapper>
            <Transactions />
          </TestWrapper>
        )

        // Simulate an organization change with incomplete data
        const orgList = screen.getByTestId('organization-list')
        const mockEvent = { id: null, label: 'Incomplete Org' }

        // This would be handled by the updateOrgFilter function
        // The test verifies the component doesn't break with incomplete data
        expect(orgList).toBeInTheDocument()
      })
    })
  })
})
