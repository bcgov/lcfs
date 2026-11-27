import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vite-plus/test'
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient
} from '@tanstack/react-query'
import {
  MemoryRouter,
  useLocation,
  useMatches,
  useNavigate,
  useParams
} from 'react-router-dom'
import ThemeProvider from '@mui/material/styles/ThemeProvider'
import theme from '@/themes'

import { AddEditViewTransfer } from '../AddEditViewTransfer'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRegExtOrgs } from '@/hooks/useOrganizations'
import { useTransfer, useCreateUpdateTransfer } from '@/hooks/useTransfer'
import { buttonClusterConfigFn } from '../buttonConfigs'
import { TRANSFER_STATUSES } from '@/constants/statuses'

const setMockReturnValue = <T extends (...args: never[]) => unknown>(
  mock: { mockReturnValue: (value: ReturnType<T>) => unknown },
  value: unknown
) => mock.mockReturnValue(value as unknown as ReturnType<T>)

type MockComponentProps = {
  children?: React.ReactNode
  'data-test'?: string
  sx?: object
  [key: string]: unknown
}

// Mock all external dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    reset: vi.fn(),
    getValues: () => 1,
    watch: () => null,
    handleSubmit: () => () => {}
  }),
  FormProvider: ({ children }: React.PropsWithChildren) => (
    <div data-test="form-provider">{children}</div>
  )
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: vi.fn(),
    useMatches: vi.fn(),
    useNavigate: vi.fn(),
    useParams: vi.fn()
  }
})

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn()
}))

vi.mock('@/hooks/useOrganizations', () => ({
  useRegExtOrgs: vi.fn()
}))

vi.mock('@/hooks/useTransfer', () => ({
  useTransfer: vi.fn(),
  useCreateUpdateTransfer: vi.fn()
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: vi.fn()
  }
})

vi.mock('@/utils/formatters', () => ({
  dateFormatter: vi.fn().mockReturnValue('2024-01-01')
}))

vi.mock('@/constants/roles', () => ({
  roles: {
    transfers: 'transfers',
    supplier: 'supplier',
    analyst: 'analyst',
    director: 'director',
    signing_authority: 'signing_authority'
  },
  govRoles: ['analyst']
}))

vi.mock('@/constants/statuses', () => ({
  TRANSFER_STATUSES: {
    DRAFT: 'Draft',
    SENT: 'Sent',
    SUBMITTED: 'Submitted',
    RECOMMENDED: 'Recommended',
    RECORDED: 'Recorded',
    DECLINED: 'Declined',
    REFUSED: 'Refused',
    RESCINDED: 'Rescinded',
    DELETED: 'Deleted'
  }
}))

vi.mock('@/routes/routes', () => ({
  ROUTES: {
    TRANSFERS: { EDIT: '/transfers/edit/:transferId' },
    TRANSACTIONS: { LIST: '/transactions' }
  },
  buildPath: (route: string, params: { transferId: string }) =>
    route.replace(':transferId', params.transferId)
}))

// Mock child components
vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }: MockComponentProps) => (
    <div data-test="bc-typography" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCAlert', () => ({
  default: React.forwardRef<HTMLDivElement, MockComponentProps>(
    function BCAlertMock({ children, ...props }, ref) {
      return (
        <div data-test="bc-alert" ref={ref} {...props}>
          {children as React.ReactNode}
        </div>
      )
    }
  )
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }: MockComponentProps) => (
    <div data-test="bc-box" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, ...props }: MockComponentProps) => (
    <button data-test="bc-button" {...props}>
      {children}
    </button>
  )
}))

vi.mock('@/components/BCModal', () => ({
  default: ({ children, ...props }: MockComponentProps) => (
    <div data-test="bc-modal" {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/Loading', () => ({
  default: ({ message }: { message: string }) => (
    <div data-test="loading">{message}</div>
  )
}))

vi.mock('@/components/Role', () => ({
  Role: ({ children }: React.PropsWithChildren) => (
    <div data-test="role">{children}</div>
  )
}))

vi.mock('@/views/Transfers/components', () => ({
  AgreementDate: () => <div data-test="agreement-date">AgreementDate</div>,
  Comments: () => <div data-test="comments">Comments</div>,
  TransferDetails: () => (
    <div data-test="transfer-details">TransferDetails</div>
  ),
  TransferGraphic: () => (
    <div data-test="transfer-graphic">TransferGraphic</div>
  ),
  TransferView: ({
    categoryOverride
  }: {
    categoryOverride?: React.ReactNode
  }) => (
    <div data-test="transfer-view">
      TransferView
      {categoryOverride}
    </div>
  )
}))

vi.mock('../components/CategoryCheckbox', () => ({
  CategoryCheckbox: () => (
    <div data-test="category-checkbox">CategoryCheckbox</div>
  )
}))

vi.mock('../components/Recommendation', () => ({
  Recommendation: () => <div data-test="recommendation">Recommendation</div>
}))

vi.mock('../components/SigningAuthority', () => ({
  default: () => <div data-test="signing-authority">SigningAuthority</div>
}))

vi.mock('@/components/Comments', () => ({
  default: () => <div data-test="entity-comments">Comments</div>
}))

vi.mock('../_schema', () => ({
  AddEditTransferSchema: {}
}))

vi.mock('../buttonConfigs', () => ({
  buttonClusterConfigFn: vi.fn()
}))

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <AddEditViewTransfer />
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AddEditViewTransfer', () => {
  const mockNavigate = vi.fn()
  const mockQueryClient = { getQueryState: vi.fn() }
  const mockMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Default safe mocks
    setMockReturnValue<typeof useNavigate>(vi.mocked(useNavigate), mockNavigate)
    setMockReturnValue<typeof useLocation>(vi.mocked(useLocation), {
      state: null
    })
    setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
      { handle: { mode: 'view' } }
    ])
    setMockReturnValue<typeof useParams>(vi.mocked(useParams), {
      transferId: null
    })
    setMockReturnValue<typeof useQueryClient>(
      vi.mocked(useQueryClient),
      mockQueryClient
    )

    setMockReturnValue<typeof useCurrentUser>(vi.mocked(useCurrentUser), {
      data: {
        organization: { organizationId: 1 },
        isGovernmentUser: false,
        roles: []
      },
      hasRoles: vi.fn().mockReturnValue(false),
      hasAnyRole: vi.fn().mockReturnValue(false)
    })

    setMockReturnValue<typeof useRegExtOrgs>(vi.mocked(useRegExtOrgs), {
      data: []
    })

    setMockReturnValue<typeof useTransfer>(vi.mocked(useTransfer), {
      data: null,
      isLoading: false,
      isFetched: false,
      isLoadingError: false
    })

    setMockReturnValue<typeof useCreateUpdateTransfer>(
      vi.mocked(useCreateUpdateTransfer),
      {
        mutate: mockMutate,
        isPending: false
      }
    )

    mockQueryClient.getQueryState.mockReturnValue({ status: 'success' })
    setMockReturnValue<typeof buttonClusterConfigFn>(
      vi.mocked(buttonClusterConfigFn),
      { New: [] }
    )
  })

  it('renders loading state when transfer data is loading', () => {
    setMockReturnValue<typeof useParams>(vi.mocked(useParams), {
      transferId: '123'
    })
    setMockReturnValue<typeof useTransfer>(vi.mocked(useTransfer), {
      data: null,
      isLoading: true,
      isFetched: false,
      isLoadingError: false
    })

    renderComponent()
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.getByText('transfer:loadingText')).toBeInTheDocument()
  })

  it('renders loading state when query is pending', () => {
    setMockReturnValue<typeof useParams>(vi.mocked(useParams), {
      transferId: '123'
    })
    mockQueryClient.getQueryState.mockReturnValue({ status: 'pending' })

    renderComponent()
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('renders updating state', () => {
    setMockReturnValue<typeof useCreateUpdateTransfer>(
      vi.mocked(useCreateUpdateTransfer),
      {
        mutate: mockMutate,
        isPending: true
      }
    )

    renderComponent()
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.getByText('transfer:processingText')).toBeInTheDocument()
  })

  it('renders add mode correctly', () => {
    setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
      { handle: { mode: 'add' } }
    ])
    setMockReturnValue<typeof useCurrentUser>(vi.mocked(useCurrentUser), {
      data: {
        organization: { organizationId: 1 },
        isGovernmentUser: false
      },
      hasRoles: vi.fn().mockReturnValue(true),
      hasAnyRole: vi.fn().mockReturnValue(false)
    })

    renderComponent()
    expect(screen.getByText('transfer:newTransfer')).toBeInTheDocument()
  })

  it('renders view mode with transfer data', () => {
    setMockReturnValue<typeof useParams>(vi.mocked(useParams), {
      transferId: '123'
    })

    renderComponent()
    expect(screen.getByTestId('transfer-view')).toBeInTheDocument()
  })

  it('renders stepper with basic data', () => {
    setMockReturnValue<typeof useTransfer>(vi.mocked(useTransfer), {
      data: {
        transferHistory: [],
        currentStatus: { status: TRANSFER_STATUSES.DRAFT }
      },
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })

    renderComponent()
    expect(screen.getByTestId('stepper')).toBeInTheDocument()
  })

  it('renders recommendation component for analysts', () => {
    setMockReturnValue<typeof useCurrentUser>(vi.mocked(useCurrentUser), {
      data: {
        organization: { organizationId: 1 },
        isGovernmentUser: false
      },
      hasRoles: vi.fn().mockReturnValue(false),
      hasAnyRole: vi.fn().mockReturnValue(true)
    })
    setMockReturnValue<typeof useTransfer>(vi.mocked(useTransfer), {
      data: {
        currentStatus: { status: TRANSFER_STATUSES.SUBMITTED }
      },
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })

    renderComponent()
    expect(screen.getByTestId('recommendation')).toBeInTheDocument()
  })

  it.each([
    {
      description: 'allows analysts on submitted transfers',
      role: 'analyst',
      status: TRANSFER_STATUSES.SUBMITTED,
      expected: true
    },
    {
      description: 'does not allow analysts after recommendation',
      role: 'analyst',
      status: TRANSFER_STATUSES.RECOMMENDED,
      expected: false
    },
    {
      description: 'does not allow analysts on recorded transfers',
      role: 'analyst',
      status: TRANSFER_STATUSES.RECORDED,
      expected: false
    },
    {
      description: 'continues to allow directors on recorded transfers',
      role: 'director',
      status: TRANSFER_STATUSES.RECORDED,
      expected: true
    }
  ])('$description', ({ role, status, expected }) => {
    setMockReturnValue<typeof useCurrentUser>(vi.mocked(useCurrentUser), {
      data: {
        organization: { organizationId: 1 },
        isGovernmentUser: true
      },
      hasRoles: vi.fn((requestedRole) => requestedRole === role),
      hasAnyRole: vi.fn().mockReturnValue(true)
    })
    setMockReturnValue<typeof useTransfer>(vi.mocked(useTransfer), {
      data: {
        transferHistory: [],
        currentStatus: { status }
      },
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })

    renderComponent()

    const categoryOverride = screen.queryByTestId('category-checkbox')
    if (expected) {
      expect(categoryOverride).toBeInTheDocument()
    } else {
      expect(categoryOverride).not.toBeInTheDocument()
    }
  })

  it('renders modal component', () => {
    renderComponent()
    expect(screen.getByTestId('bc-modal')).toBeInTheDocument()
  })

  it('renders back button', () => {
    renderComponent()
    const backButton = screen.getByText('backBtn')
    expect(backButton).toBeInTheDocument()
  })

  it('handles null button config', () => {
    setMockReturnValue<typeof buttonClusterConfigFn>(
      vi.mocked(buttonClusterConfigFn),
      { New: [null] }
    )
    renderComponent()
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument()
  })

  it('generates correct title for view mode', () => {
    setMockReturnValue<typeof useParams>(vi.mocked(useParams), {
      transferId: '456'
    })
    renderComponent()
    expect(screen.getByText('transfer:transferID CT456')).toBeInTheDocument()
  })

  it('prevents editor mode without proper permissions', () => {
    setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
      { handle: { mode: 'edit' } }
    ])
    setMockReturnValue<typeof useCurrentUser>(vi.mocked(useCurrentUser), {
      data: {
        organization: { organizationId: 1 },
        isGovernmentUser: false
      },
      hasRoles: vi.fn().mockReturnValue(false),
      hasAnyRole: vi.fn().mockReturnValue(false)
    })

    renderComponent()
    expect(screen.queryByTestId('transfer-graphic')).not.toBeInTheDocument()
  })

  it('includes recommended step for government users', () => {
    setMockReturnValue<typeof useCurrentUser>(vi.mocked(useCurrentUser), {
      data: {
        organization: { organizationId: 1 },
        isGovernmentUser: true
      },
      hasRoles: vi.fn().mockReturnValue(false),
      hasAnyRole: vi.fn().mockReturnValue(false)
    })

    setMockReturnValue<typeof useTransfer>(vi.mocked(useTransfer), {
      data: {
        transferHistory: [
          { transferStatus: { status: TRANSFER_STATUSES.SUBMITTED } }
        ],
        currentStatus: { status: TRANSFER_STATUSES.SUBMITTED }
      },
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })

    renderComponent()
    expect(screen.getByTestId('stepper')).toBeInTheDocument()
  })

  it('renders stepper with transfer history', () => {
    setMockReturnValue<typeof useTransfer>(vi.mocked(useTransfer), {
      data: {
        transferHistory: [
          { transferStatus: { status: TRANSFER_STATUSES.SENT } }
        ],
        currentStatus: { status: TRANSFER_STATUSES.SENT }
      },
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })

    renderComponent()
    expect(screen.getByTestId('stepper')).toBeInTheDocument()
  })

  it('handles component initialization', () => {
    renderComponent()
    expect(screen.getByTestId('form-provider')).toBeInTheDocument()
  })

  it('renders with current user organization data', () => {
    renderComponent()
    expect(screen.getByText('transfer:transferID CTnull')).toBeInTheDocument()
  })
})
