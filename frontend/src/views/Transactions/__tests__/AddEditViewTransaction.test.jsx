import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { AddEditViewTransaction } from '../AddEditViewTransaction'
import { useTranslation } from 'react-i18next'
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
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material')
  return {
    ...actual,
    useMediaQuery: vi.fn()
  }
})

// Partial mock for react-router-dom to retain MemoryRouter
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
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
    t: vi.fn((key) => key)
  })
}))

vi.mock('@hookform/resolvers/yup', () => ({
  yupResolver: vi.fn()
}))

vi.mock('@/hooks/useAdminAdjustment', () => ({
  useAdminAdjustment: vi.fn(),
  useCreateUpdateAdminAdjustment: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isLoading: false
  })
}))

vi.mock('@/hooks/useInitiativeAgreement', () => ({
  useInitiativeAgreement: vi.fn(),
  useCreateUpdateInitiativeAgreement: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isLoading: false
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
    isLoading: false
  }))
}))

vi.mock('react-hook-form', () => ({
  FormProvider: ({ children }) => children,
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
  Controller: ({ render, name }) => render({
    field: { value: '', onChange: vi.fn() },
    fieldState: { error: null }
  })
}))

const renderComponent = (
  handleMode = 'edit',
  txnType = INITIATIVE_AGREEMENT
) => {
  const queryClient = new QueryClient()
  queryClient.getQueryState = vi.fn().mockReturnValue({
    status: 'success'
  })

  let path = ''
  switch (handleMode) {
    case 'view':
      path =
        txnType === ADMIN_ADJUSTMENT
          ? '/admin-adjustment/1'
          : '/initiative-agreement/1'
      break
    case 'edit':
      path =
        txnType === ADMIN_ADJUSTMENT
          ? '/admin-adjustment/edit/1'
          : '/initiative-agreement/edit/1'
      break
    case 'add':
      path = '/transactions/add'
      break
  }
  useTranslation.mockReturnValue({ t: vi.fn((key) => key) })

  useTransactionMutation.mockReturnValue({
    handleSuccess: vi.fn(),
    handleError: vi.fn()
  })

  useCreateUpdateAdminAdjustment.mockReturnValue({
    mutate: vi.fn(),
    isLoading: false
  })

  useCreateUpdateInitiativeAgreement.mockReturnValue({
    mutate: vi.fn(),
    isLoading: false
  })


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
    vi.resetAllMocks()
  })

  it('renders without crashing', () => {
    useParams.mockReturnValue({})
    useMatches.mockReturnValue([{ handle: { mode: 'add' } }])
    useLocation.mockReturnValue({
      pathname: '/initiative-agreement/add',
      state: null
    })
    useInitiativeAgreement.mockReturnValue({ data: null })
    renderComponent()
  })


  it('displays an error message when there is a loading error', () => {
    useInitiativeAgreement.mockReturnValue({
      data: null,
      isLoading: false,
      isFetched: true,
      isLoadingError: true
    })
    useCreateUpdateInitiativeAgreement.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })
    useParams.mockReturnValue({ transactionId: 1 })
    useMatches.mockReturnValue([{ handle: { mode: 'edit' } }])
    useLocation.mockReturnValue({
      pathname: '/initiative-agreement/edit/1',
      state: null
    })

    renderComponent('edit', INITIATIVE_AGREEMENT)
    expect(
      screen.getByText('initiativeAgreement:actionMsgs.errorRetrieval')
    ).toBeInTheDocument()
  })

  it('renders Add mode for Initiative Agreement correctly', async () => {
    useInitiativeAgreement.mockReturnValue({
      data: null,
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })
    useCreateUpdateInitiativeAgreement.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })

    useParams.mockReturnValue({})
    useMatches.mockReturnValue([{ handle: { mode: 'add' } }])
    useLocation.mockReturnValue({
      pathname: '/initiative-agreement/add',
      state: null
    })

    useOrganizationNames.mockReturnValue({
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
    useOrganizationBalance.mockReturnValue({
      data: {
        organizationId: 1,
        totalBalance: 50614,
        reservedBalance: 0
      },
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })

    renderComponent('add', INITIATIVE_AGREEMENT)
    expect(screen.getByText('txn:newTransaction')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument()
    })
  })

  it('renders Edit mode for Initiative Agreement correctly', async () => {
    useInitiativeAgreement.mockReturnValue({
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
    })
    useParams.mockReturnValue({ transactionId: 1 })
    useMatches.mockReturnValue([{ handle: { mode: 'edit' } }])
    useLocation.mockReturnValue({
      pathname: '/initiative-agreement/edit/1',
      state: null
    })
    useCreateUpdateInitiativeAgreement.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })
    useOrganizationNames.mockReturnValue({
      data: [],
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })
    useOrganizationBalance.mockReturnValue({
      data: {},
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })

    renderComponent('edit', INITIATIVE_AGREEMENT)

    await waitFor(() => {
      expect(
        screen.getByText('Edit initiativeAgreement:initiativeAgreement IA1')
      ).toBeInTheDocument()
    })
  })

  it('renders View mode for Initiative Agreement correctly', async () => {
    useInitiativeAgreement.mockReturnValue({
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
    })
    useParams.mockReturnValue({ transactionId: 1 })
    useMatches.mockReturnValue([{ handle: { mode: 'view' } }])
    useLocation.mockReturnValue({
      pathname: '/initiative-agreement/1',
      state: null
    })
    useCreateUpdateInitiativeAgreement.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })
    renderComponent('view', INITIATIVE_AGREEMENT)
    await waitFor(() => {
      expect(
        screen.getByText('initiativeAgreement:initiativeAgreement IA1')
      ).toBeInTheDocument()
    })
  })

  it('renders Add mode for Admin Adjustment correctly', async () => {
    useAdminAdjustment.mockReturnValue({
      data: null,
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })
    useInitiativeAgreement.mockReturnValue({
      data: null,
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })

    useOrganizationNames.mockReturnValue({
      data: [],
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })
    useOrganizationBalance.mockReturnValue({
      data: {},
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })

    useCreateUpdateAdminAdjustment.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })
    useCreateUpdateInitiativeAgreement.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })

    useParams.mockReturnValue({})
    useMatches.mockReturnValue([{ handle: { mode: 'add' } }])
    useLocation.mockReturnValue({
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
    useAdminAdjustment.mockReturnValue({
      data: {
        adminAdjustmenId: 1,
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
    })
    useInitiativeAgreement.mockReturnValue({
      data: null,
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })

    useParams.mockReturnValue({ transactionId: 1 })
    useMatches.mockReturnValue([{ handle: { mode: 'edit' } }])
    useLocation.mockReturnValue({
      pathname: '/admin-adjustment/edit/1',
      state: null
    })

    useCreateUpdateAdminAdjustment.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })
    useCreateUpdateInitiativeAgreement.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })

    useOrganizationNames.mockReturnValue({
      data: [],
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })
    useOrganizationBalance.mockReturnValue({
      data: {},
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })

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
    useAdminAdjustment.mockReturnValue({
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
    })
    useInitiativeAgreement.mockReturnValue({
      data: null,
      isLoading: false,
      isFetched: true,
      isLoadingError: false
    })

    useParams.mockReturnValue({ transactionId: 1 })
    useMatches.mockReturnValue([{ handle: { mode: 'view' } }])
    useLocation.mockReturnValue({
      pathname: '/admin-adjustment/1',
      state: null
    })

    useCreateUpdateAdminAdjustment.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })
    useCreateUpdateInitiativeAgreement.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })

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
      useParams.mockReturnValue({ transactionId: '123' })
      useMatches.mockReturnValue([{ handle: { mode: 'view' } }])
      useLocation.mockReturnValue({
        pathname: '/admin-adjustment/123',
        state: null
      })
      useAdminAdjustment.mockReturnValue({
        data: {
          adminAdjustmentId: 123,
          currentStatus: { status: TRANSACTION_STATUSES.DRAFT },
          history: []
        },
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      })

      renderComponent('view', ADMIN_ADJUSTMENT)
      expect(screen.getByText('administrativeAdjustment:administrativeAdjustment AA123')).toBeInTheDocument()
    })

    it('should format initiative agreement transaction ID correctly', () => {
      useParams.mockReturnValue({ transactionId: '456' })
      useMatches.mockReturnValue([{ handle: { mode: 'view' } }])
      useLocation.mockReturnValue({
        pathname: '/initiative-agreement/456',
        state: null
      })
      useInitiativeAgreement.mockReturnValue({
        data: {
          initiativeAgreementId: 456,
          currentStatus: { status: TRANSACTION_STATUSES.DRAFT },
          history: []
        },
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      })

      renderComponent('view', INITIATIVE_AGREEMENT)
      expect(screen.getByText('initiativeAgreement:initiativeAgreement IA456')).toBeInTheDocument()
    })
  })

  describe('Status-based rendering', () => {
    it('should render different steps for recommended status', async () => {
      useParams.mockReturnValue({ transactionId: '1' })
      useMatches.mockReturnValue([{ handle: { mode: 'view' } }])
      useLocation.mockReturnValue({
        pathname: '/initiative-agreement/1',
        state: null
      })
      useInitiativeAgreement.mockReturnValue({
        data: {
          initiativeAgreementId: 1,
          currentStatus: { status: TRANSACTION_STATUSES.RECOMMENDED },
          history: []
        },
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      })

      renderComponent('view', INITIATIVE_AGREEMENT)
      await waitFor(() => {
        expect(screen.getByText('Recommended')).toBeInTheDocument()
      })
    })
  })




})
