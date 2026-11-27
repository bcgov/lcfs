import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ThemeProvider from '@mui/material/styles/ThemeProvider'
import theme from '@/themes'
import { AddEditViewTransaction } from '../AddEditViewTransaction'
import {
  MemoryRouter,
  useLocation,
  useMatches,
  useParams
} from 'react-router-dom'
import {
  useAdminAdjustment,
  useCreateUpdateAdminAdjustment
} from '@/hooks/useAdminAdjustment'
import {
  useCreateUpdateInitiativeAgreement,
  useInitiativeAgreement
} from '@/hooks/useInitiativeAgreement'
import { useOrganizationNames } from '@/hooks/useOrganizations'
import { useOrganizationBalance } from '@/hooks/useOrganization'
import { useTransactionMutation } from '../transactionMutation'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import {
  ADMIN_ADJUSTMENT,
  INITIATIVE_AGREEMENT
} from '@/views/Transactions/constants'

const setMockReturnValue = <T extends (...args: never[]) => unknown>(
  mock: { mockReturnValue: (value: ReturnType<T>) => unknown },
  value: unknown
) => mock.mockReturnValue(value as ReturnType<T>)

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

// Partial mock for @mui/material to retain ThemeProvider
vi.mock('@mui/material/useMediaQuery', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@mui/material/useMediaQuery')>()
  return {
    ...actual,
    default: vi.fn()
  }
})

// Partial mock for react-router-dom to retain MemoryRouter
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useParams: vi.fn(() => ({ transactionId: '1' })),
    useNavigate: vi.fn(),
    useLocation: vi.fn(),
    useMatches: vi.fn()
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn().mockReturnValue({
    t: vi.fn((key: string) => key)
  })
}))

vi.mock('@hookform/resolvers/yup', () => ({
  yupResolver: vi.fn()
}))

vi.mock('@/hooks/useAdminAdjustment', () => ({
  useAdminAdjustment: vi.fn(),
  useCreateUpdateAdminAdjustment: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false
  })
}))

vi.mock('@/hooks/useInitiativeAgreement', () => ({
  useInitiativeAgreement: vi.fn(),
  useCreateUpdateInitiativeAgreement: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false
  })
}))

// Mocking Keycloak and Current User
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: {
      roles: [
        { name: 'Administrator' },
        { name: 'Government' },
        { name: 'Analyst' }
      ]
    },
    hasRoles: vi.fn(),
    hasAnyRole: vi.fn().mockReturnValue(true)
  })
}))

vi.mock('../transactionMutation', () => ({
  useTransactionMutation: vi.fn()
}))

vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: vi.fn()
}))

// Mock the hooks
vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizationNames: vi.fn().mockReturnValue({
    data: [
      {
        organizationId: 1,
        name: 'LCFS Org 1',
        operatingName: 'LCFS Org 1',
        totalBalance: 50614,
        reservedBalance: 0,
        orgStatus: {
          organizationStatusId: 2,
          status: 'Registered',
          description: 'Registered'
        }
      },
      {
        organizationId: 2,
        name: 'LCFS Org 2',
        operatingName: 'LCFS Org 2',
        totalBalance: 50123,
        reservedBalance: 0,
        orgStatus: {
          organizationStatusId: 2,
          status: 'Registered',
          description: 'Registered'
        }
      }
    ],
    isLoading: false,
    isFetched: true,
    isLoadingError: false
  })
}))
vi.mock('@/hooks/useOrganization', () => ({
  useOrganizationBalance: vi.fn().mockReturnValue({
    data: {
      organizationId: 1,
      totalBalance: 50614,
      reservedBalance: 0
    },
    isLoading: false,
    isFetched: true,
    isLoadingError: false
  })
}))

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn()
  })
}))

vi.mock('@/hooks/useTransactions.js', () => ({
  useTransactionDocuments: vi.fn(() => ({
    data: null,
    isPending: false
  }))
}))

vi.mock('react-hook-form', () => ({
  FormProvider: ({ children }: { children: React.ReactNode }) => children,
  useForm: vi.fn(() => ({
    watch: vi.fn(() => 'initiativeAgreement'),
    setValue: vi.fn(),
    formState: { errors: {} },
    handleSubmit: vi.fn((fn) => fn),
    reset: vi.fn(),
    register: vi.fn(),
    control: {},
    getValues: vi.fn(() => ({}))
  })),
  useFormContext: vi.fn(() => ({
    watch: vi.fn(() => 'initiativeAgreement'),
    setValue: vi.fn(),
    formState: { errors: {} },
    handleSubmit: vi.fn((fn) => fn),
    reset: vi.fn(),
    getValues: vi.fn(() => ({})),
    register: vi.fn(),
    control: {}
  })),
  Controller: ({
    render
  }: {
    render: (props: {
      field: { value: string; onChange: () => void }
      fieldState: { error: null }
    }) => React.ReactNode
  }) =>
    render({
      field: { value: '', onChange: vi.fn() },
      fieldState: { error: null }
    })
}))

const renderComponent = (_mode?: string, _transactionType?: string) => {
  const queryClient = new QueryClient()
  queryClient.getQueryState = vi.fn().mockReturnValue({
    status: 'success'
  })

  setMockReturnValue<typeof useTransactionMutation>(
    vi.mocked(useTransactionMutation),
    {
      handleSuccess: vi.fn(),
      handleError: vi.fn()
    }
  )

  setMockReturnValue<typeof useCreateUpdateAdminAdjustment>(
    vi.mocked(useCreateUpdateAdminAdjustment),
    {
      mutate: vi.fn(),
      isPending: false
    }
  )

  setMockReturnValue<typeof useCreateUpdateInitiativeAgreement>(
    vi.mocked(useCreateUpdateInitiativeAgreement),
    {
      mutate: vi.fn(),
      isPending: false
    }
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <AddEditViewTransaction />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('AddEditViewTransaction Component Tests', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    setMockReturnValue<typeof useParams>(vi.mocked(useParams), {})
    setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
      { handle: { mode: 'add' } }
    ])
    setMockReturnValue<typeof useLocation>(vi.mocked(useLocation), {
      pathname: '/initiative-agreement/add',
      state: null
    })
    setMockReturnValue<typeof useInitiativeAgreement>(
      vi.mocked(useInitiativeAgreement),
      { data: null }
    )
    renderComponent()
  })

  it('displays an error message when there is a loading error', () => {
    setMockReturnValue<typeof useInitiativeAgreement>(
      vi.mocked(useInitiativeAgreement),
      {
        data: null,
        isLoading: false,
        isFetched: true,
        isLoadingError: true
      }
    )
    setMockReturnValue<typeof useCreateUpdateInitiativeAgreement>(
      vi.mocked(useCreateUpdateInitiativeAgreement),
      {
        mutate: vi.fn(),
        isPending: false
      }
    )
    setMockReturnValue<typeof useParams>(vi.mocked(useParams), {
      transactionId: '1'
    })
    setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
      { handle: { mode: 'edit' } }
    ])
    setMockReturnValue<typeof useLocation>(vi.mocked(useLocation), {
      pathname: '/initiative-agreement/edit/1',
      state: null
    })

    renderComponent('edit', INITIATIVE_AGREEMENT)
    expect(
      screen.getByText('initiativeAgreement:actionMsgs.errorRetrieval')
    ).toBeInTheDocument()
  })

  it('renders Add mode for Initiative Agreement correctly', async () => {
    setMockReturnValue<typeof useInitiativeAgreement>(
      vi.mocked(useInitiativeAgreement),
      {
        data: null,
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )
    setMockReturnValue<typeof useCreateUpdateInitiativeAgreement>(
      vi.mocked(useCreateUpdateInitiativeAgreement),
      {
        mutate: vi.fn(),
        isPending: false
      }
    )

    setMockReturnValue<typeof useParams>(vi.mocked(useParams), {})
    setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
      { handle: { mode: 'add' } }
    ])
    setMockReturnValue<typeof useLocation>(vi.mocked(useLocation), {
      pathname: '/initiative-agreement/add',
      state: null
    })

    setMockReturnValue<typeof useOrganizationNames>(
      vi.mocked(useOrganizationNames),
      {
        data: [
          {
            organizationId: 1,
            name: 'LCFS Org 1',
            operatingName: 'LCFS Org 1',
            totalBalance: 50614,
            reservedBalance: 0,
            orgStatus: {
              organizationStatusId: 2,
              status: 'Registered',
              description: 'Registered'
            }
          },
          {
            organizationId: 2,
            name: 'LCFS Org 2',
            operatingName: 'LCFS Org 2',
            totalBalance: 50123,
            reservedBalance: 0,
            orgStatus: {
              organizationStatusId: 2,
              status: 'Registered',
              description: 'Registered'
            }
          }
        ],
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )
    setMockReturnValue<typeof useOrganizationBalance>(
      vi.mocked(useOrganizationBalance),
      {
        data: {
          organizationId: 1,
          totalBalance: 50614,
          reservedBalance: 0
        },
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )

    renderComponent('add', INITIATIVE_AGREEMENT)
    expect(screen.getByText('txn:newTransaction')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument()
    })
  })

  it('renders Edit mode for Initiative Agreement correctly', async () => {
    setMockReturnValue<typeof useInitiativeAgreement>(
      vi.mocked(useInitiativeAgreement),
      {
        data: {
          initiativeAgreementId: 1,
          currentStatus: { status: TRANSACTION_STATUSES.DRAFT },
          history: [],
          govComment: 'Test comment',
          toOrganizationId: '123',
          complianceUnits: '10',
          transactionEffectiveDate: '2024-01-01'
        },
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )
    setMockReturnValue<typeof useParams>(vi.mocked(useParams), {
      transactionId: '1'
    })
    setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
      { handle: { mode: 'edit' } }
    ])
    setMockReturnValue<typeof useLocation>(vi.mocked(useLocation), {
      pathname: '/initiative-agreement/edit/1',
      state: null
    })
    setMockReturnValue<typeof useCreateUpdateInitiativeAgreement>(
      vi.mocked(useCreateUpdateInitiativeAgreement),
      {
        mutate: vi.fn(),
        isPending: false
      }
    )
    setMockReturnValue<typeof useOrganizationNames>(
      vi.mocked(useOrganizationNames),
      {
        data: [],
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )
    setMockReturnValue<typeof useOrganizationBalance>(
      vi.mocked(useOrganizationBalance),
      {
        data: {},
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )

    renderComponent('edit', INITIATIVE_AGREEMENT)

    await waitFor(() => {
      expect(
        screen.getByText('Edit initiativeAgreement:initiativeAgreement IA1')
      ).toBeInTheDocument()
    })
  })

  it('renders View mode for Initiative Agreement correctly', async () => {
    setMockReturnValue<typeof useInitiativeAgreement>(
      vi.mocked(useInitiativeAgreement),
      {
        data: {
          initiativeAgreementId: 1,
          currentStatus: { status: TRANSACTION_STATUSES.DRAFT },
          history: [],
          govComment: 'Test comment',
          toOrganizationId: '123',
          complianceUnits: '10',
          transactionEffectiveDate: '2024-01-01'
        },
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )
    setMockReturnValue<typeof useParams>(vi.mocked(useParams), {
      transactionId: '1'
    })
    setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
      { handle: { mode: 'view' } }
    ])
    setMockReturnValue<typeof useLocation>(vi.mocked(useLocation), {
      pathname: '/initiative-agreement/1',
      state: null
    })
    setMockReturnValue<typeof useCreateUpdateInitiativeAgreement>(
      vi.mocked(useCreateUpdateInitiativeAgreement),
      {
        mutate: vi.fn(),
        isPending: false
      }
    )
    renderComponent('view', INITIATIVE_AGREEMENT)
    await waitFor(() => {
      expect(
        screen.getByText('initiativeAgreement:initiativeAgreement IA1')
      ).toBeInTheDocument()
    })
  })

  it('renders Add mode for Admin Adjustment correctly', async () => {
    setMockReturnValue<typeof useAdminAdjustment>(
      vi.mocked(useAdminAdjustment),
      {
        data: null,
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )
    setMockReturnValue<typeof useInitiativeAgreement>(
      vi.mocked(useInitiativeAgreement),
      {
        data: null,
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )

    setMockReturnValue<typeof useOrganizationNames>(
      vi.mocked(useOrganizationNames),
      {
        data: [],
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )
    setMockReturnValue<typeof useOrganizationBalance>(
      vi.mocked(useOrganizationBalance),
      {
        data: {},
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )

    setMockReturnValue<typeof useCreateUpdateAdminAdjustment>(
      vi.mocked(useCreateUpdateAdminAdjustment),
      {
        mutate: vi.fn(),
        isPending: false
      }
    )
    setMockReturnValue<typeof useCreateUpdateInitiativeAgreement>(
      vi.mocked(useCreateUpdateInitiativeAgreement),
      {
        mutate: vi.fn(),
        isPending: false
      }
    )

    setMockReturnValue<typeof useParams>(vi.mocked(useParams), {})
    setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
      { handle: { mode: 'add' } }
    ])
    setMockReturnValue<typeof useLocation>(vi.mocked(useLocation), {
      pathname: '/admin-adjustment/add',
      state: null
    })

    renderComponent('add', ADMIN_ADJUSTMENT)
    expect(screen.getByText('txn:newTransaction')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument()
    })
  })

  it('renders Edit mode for Admin Adjustment correctly', async () => {
    setMockReturnValue<typeof useAdminAdjustment>(
      vi.mocked(useAdminAdjustment),
      {
        data: {
          adminAdjustmentId: 1,
          currentStatus: { status: TRANSACTION_STATUSES.DRAFT },
          history: [],
          govComment: 'Test comment',
          toOrganizationId: '123',
          complianceUnits: '10',
          transactionEffectiveDate: '2024-01-01'
        },
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )
    setMockReturnValue<typeof useInitiativeAgreement>(
      vi.mocked(useInitiativeAgreement),
      {
        data: null,
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )

    setMockReturnValue<typeof useParams>(vi.mocked(useParams), {
      transactionId: '1'
    })
    setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
      { handle: { mode: 'edit' } }
    ])
    setMockReturnValue<typeof useLocation>(vi.mocked(useLocation), {
      pathname: '/admin-adjustment/edit/1',
      state: null
    })

    setMockReturnValue<typeof useCreateUpdateAdminAdjustment>(
      vi.mocked(useCreateUpdateAdminAdjustment),
      {
        mutate: vi.fn(),
        isPending: false
      }
    )
    setMockReturnValue<typeof useCreateUpdateInitiativeAgreement>(
      vi.mocked(useCreateUpdateInitiativeAgreement),
      {
        mutate: vi.fn(),
        isPending: false
      }
    )

    setMockReturnValue<typeof useOrganizationNames>(
      vi.mocked(useOrganizationNames),
      {
        data: [],
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )
    setMockReturnValue<typeof useOrganizationBalance>(
      vi.mocked(useOrganizationBalance),
      {
        data: {},
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )

    renderComponent('edit', ADMIN_ADJUSTMENT)

    await waitFor(() => {
      expect(
        screen.getByText(
          'Edit administrativeAdjustment:administrativeAdjustment AA1'
        )
      ).toBeInTheDocument()
    })
  })

  it('renders View mode for Admin Adjustment correctly', async () => {
    setMockReturnValue<typeof useAdminAdjustment>(
      vi.mocked(useAdminAdjustment),
      {
        data: {
          adminAdjustmentId: 1,
          currentStatus: { status: TRANSACTION_STATUSES.DRAFT },
          history: [],
          govComment: 'Test comment',
          toOrganizationId: '123',
          complianceUnits: '10',
          transactionEffectiveDate: '2024-01-01'
        },
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )
    setMockReturnValue<typeof useInitiativeAgreement>(
      vi.mocked(useInitiativeAgreement),
      {
        data: null,
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      }
    )

    setMockReturnValue<typeof useParams>(vi.mocked(useParams), {
      transactionId: '1'
    })
    setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
      { handle: { mode: 'view' } }
    ])
    setMockReturnValue<typeof useLocation>(vi.mocked(useLocation), {
      pathname: '/admin-adjustment/1',
      state: null
    })

    setMockReturnValue<typeof useCreateUpdateAdminAdjustment>(
      vi.mocked(useCreateUpdateAdminAdjustment),
      {
        mutate: vi.fn(),
        isPending: false
      }
    )
    setMockReturnValue<typeof useCreateUpdateInitiativeAgreement>(
      vi.mocked(useCreateUpdateInitiativeAgreement),
      {
        mutate: vi.fn(),
        isPending: false
      }
    )

    renderComponent('view', ADMIN_ADJUSTMENT)

    await waitFor(() => {
      expect(
        screen.getByText(
          'administrativeAdjustment:administrativeAdjustment AA1'
        )
      ).toBeInTheDocument()
    })
  })

  describe('formatTransactionId function', () => {
    it('should format admin adjustment transaction ID correctly', () => {
      setMockReturnValue<typeof useParams>(vi.mocked(useParams), {
        transactionId: '123'
      })
      setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
        { handle: { mode: 'view' } }
      ])
      setMockReturnValue<typeof useLocation>(vi.mocked(useLocation), {
        pathname: '/admin-adjustment/123',
        state: null
      })
      setMockReturnValue<typeof useAdminAdjustment>(
        vi.mocked(useAdminAdjustment),
        {
          data: {
            adminAdjustmentId: 123,
            currentStatus: { status: TRANSACTION_STATUSES.DRAFT },
            history: []
          },
          isLoading: false,
          isFetched: true,
          isLoadingError: false
        }
      )

      renderComponent('view', ADMIN_ADJUSTMENT)
      expect(
        screen.getByText(
          'administrativeAdjustment:administrativeAdjustment AA123'
        )
      ).toBeInTheDocument()
    })

    it('should format initiative agreement transaction ID correctly', () => {
      setMockReturnValue<typeof useParams>(vi.mocked(useParams), {
        transactionId: '456'
      })
      setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
        { handle: { mode: 'view' } }
      ])
      setMockReturnValue<typeof useLocation>(vi.mocked(useLocation), {
        pathname: '/initiative-agreement/456',
        state: null
      })
      setMockReturnValue<typeof useInitiativeAgreement>(
        vi.mocked(useInitiativeAgreement),
        {
          data: {
            initiativeAgreementId: 456,
            currentStatus: { status: TRANSACTION_STATUSES.DRAFT },
            history: []
          },
          isLoading: false,
          isFetched: true,
          isLoadingError: false
        }
      )

      renderComponent('view', INITIATIVE_AGREEMENT)
      expect(
        screen.getByText('initiativeAgreement:initiativeAgreement IA456')
      ).toBeInTheDocument()
    })
  })

  describe('Status-based rendering', () => {
    it('should render different steps for recommended status', async () => {
      setMockReturnValue<typeof useParams>(vi.mocked(useParams), {
        transactionId: '1'
      })
      setMockReturnValue<typeof useMatches>(vi.mocked(useMatches), [
        { handle: { mode: 'view' } }
      ])
      setMockReturnValue<typeof useLocation>(vi.mocked(useLocation), {
        pathname: '/initiative-agreement/1',
        state: null
      })
      setMockReturnValue<typeof useInitiativeAgreement>(
        vi.mocked(useInitiativeAgreement),
        {
          data: {
            initiativeAgreementId: 1,
            currentStatus: { status: TRANSACTION_STATUSES.RECOMMENDED },
            history: []
          },
          isLoading: false,
          isFetched: true,
          isLoadingError: false
        }
      )

      renderComponent('view', INITIATIVE_AGREEMENT)
      await waitFor(() => {
        expect(screen.getByText('Recommended')).toBeInTheDocument()
      })
    })
  })
})
