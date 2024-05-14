import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { AddEditViewTransaction, INITIATIVE_AGREEMENT, ADMIN_ADJUSTMENT } from '../AddEditViewTransaction'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation, useParams, useMatches } from 'react-router-dom'
import { yupResolver } from '@hookform/resolvers/yup'
import { useAdminAdjustment, useCreateUpdateAdminAdjustment } from '@/hooks/useAdminAdjustment'
import { useInitiativeAgreement, useCreateUpdateInitiativeAgreement } from '@/hooks/useInitiativeAgreement'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTransactionMutation } from '../transactionMutation'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import { AddEditTransactionSchema } from '../_schema.yup'

const testCases = [
  { mode: 'add', txnType: INITIATIVE_AGREEMENT, description: 'renders Add mode for Initiative Agreement' },
  { mode: 'edit', txnType: INITIATIVE_AGREEMENT, description: 'renders Edit mode for Initiative Agreement' },
  { mode: 'view', txnType: INITIATIVE_AGREEMENT, description: 'renders View mode for Initiative Agreement' },
  { mode: 'add', txnType: ADMIN_ADJUSTMENT, description: 'renders Add mode for Admin Adjustment' },
  { mode: 'edit', txnType: ADMIN_ADJUSTMENT, description: 'renders Edit mode for Admin Adjustment' },
  { mode: 'view', txnType: ADMIN_ADJUSTMENT, description: 'renders View mode for Admin Adjustment' },
]

const mockOrganizationBalance = {
  organizationId: 1,
  totalBalance: 50614,
  reservedBalance: 0,
}

const mockOrganizations = [
  {
    organizationId: 1,
    name: "LCFS Org 1",
    operatingName: "LCFS Org 1",
    totalBalance: 50614,
    reservedBalance: 0,
    orgStatus: {
      organizationStatusId: 2,
      status: "Registered",
      description: "Registered",
    },
  },
  {
    organizationId: 2,
    name: "LCFS Org 2",
    operatingName: "LCFS Org 2",
    totalBalance: 50123,
    reservedBalance: 0,
    orgStatus: {
      organizationStatusId: 2,
      status: "Registered",
      description: "Registered",
    },
  }
]

const keycloak = vi.hoisted(() => ({
  useKeycloak: vi.fn()
}))
vi.mock('@react-keycloak/web', () => keycloak)

// vi.mock('@react-keycloak/web', () => ({
//   useKeycloak: () => ({
//     keycloak: { authenticated: true, token: 'mock-token' },
//     initialized: true
//   })
// }))

// Partial mock for @mui/material to retain ThemeProvider
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material')
  return {
    ...actual,
    useMediaQuery: vi.fn(),
  }
})

// Partial mock for react-router-dom to retain MemoryRouter
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
    useLocation: vi.fn(),
    useMatches: vi.fn(),
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn().mockReturnValue({
    t: vi.fn((key) => key),
  }),
}))

vi.mock('@hookform/resolvers/yup', () => ({
  yupResolver: vi.fn(),
}))

vi.mock('@/hooks/useAdminAdjustment', () => ({
  useAdminAdjustment: vi.fn(),
  useCreateUpdateAdminAdjustment: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isLoading: false,
  }),
}))

vi.mock('@/hooks/useInitiativeAgreement', () => ({
  useInitiativeAgreement: vi.fn(),
  useCreateUpdateInitiativeAgreement: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isLoading: false,
  }),
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}))

vi.mock('../transactionMutation', () => ({
  useTransactionMutation: vi.fn(),
}))

vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: vi.fn(),
}))

// Mock the hooks
vi.mock('@/hooks/useOrganization', () => ({
  useRegExtOrgs: vi.fn().mockReturnValue({
    data: mockOrganizations,
    isLoading: false,
    isFetched: true,
    isLoadingError: false,
  }),
  useOrganizationBalance: vi.fn().mockReturnValue({
    data: mockOrganizationBalance,
    isLoading: false,
    isFetched: true,
    isLoadingError: false,
  }),
}))

const renderComponent = (handleMode = 'edit', txnType = INITIATIVE_AGREEMENT) => {
  const queryClient = new QueryClient()
  queryClient.getQueryState = vi.fn().mockReturnValue({
    status: 'success',
  })

  let path = ''
  switch (handleMode) {
    case 'view':
      path = txnType === ADMIN_ADJUSTMENT ? '/admin-adjustment/1' : '/initiative-agreement/1'
      break
    case 'edit':
      path = txnType === ADMIN_ADJUSTMENT ? '/admin-adjustment/edit/1' : '/initiative-agreement/edit/1'
      break
    case 'add':
      path = '/transactions/add'
      break
  }

  useMatches.mockReturnValue([{ handle: { mode: handleMode } }])
  useParams.mockReturnValue({ transactionId: '1' })
  useNavigate.mockReturnValue(vi.fn())
  useLocation.mockReturnValue({ pathname: path, state: null })

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
  beforeEach(() => {
    keycloak.useKeycloak.mockReturnValue({
      keycloak: { authenticated: true },
      initialized: true
    })
    useParams.mockReturnValue({ transactionId: '1' })
    useNavigate.mockReturnValue(vi.fn())
    useLocation.mockReturnValue({ pathname: '/some-path', state: null })
    useMatches.mockReturnValue([{ handle: { mode: 'edit' } }])
    useTranslation.mockReturnValue({
      t: vi.fn((key) => key),
    })
    useCreateUpdateAdminAdjustment.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })
    useCreateUpdateInitiativeAgreement.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false
    })
    useAdminAdjustment.mockReturnValue({
      data: null,
      isLoading: true,
      isFetched: false,
      isLoadingError: false,
    })
    useInitiativeAgreement.mockReturnValue({
      data: null,
      isLoading: true,
      isFetched: false,
      isLoadingError: false,
    })
    useCurrentUser.mockReturnValue({
      data: { isGovernmentUser: true },
      hasRoles: vi.fn(),
      hasAnyRole: vi.fn().mockReturnValue(true),
    })
    useTransactionMutation.mockReturnValue({
      handleSuccess: vi.fn(),
      handleError: vi.fn(),
    })
    // useForm.mockReturnValue({
    //   reset: vi.fn(),
    //   watch: vi.fn(),
    //   setValue: vi.fn(),
    //   handleSubmit: vi.fn(),
    //   formState: { errors: {} },
    // })
  })

  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  it('renders without crashing', () => {
    renderComponent()
  })

  // it('displays a loading indicator when data is being fetched', () => {
  //   renderComponent()
  //   expect(screen.getByText('initiativeagreement:loadingText')).toBeInTheDocument()
  // })

  // it('displays an error message when there is a loading error', () => {
  //   useInitiativeAgreement.mockReturnValueOnce({
  //     data: null,
  //     isLoading: false,
  //     isFetched: true,
  //     isLoadingError: true,
  //   })

  //   renderComponent()
  //   expect(screen.getByText('initiativeagreement:actionMsgs.errorRetrieval')).toBeInTheDocument()
  // })

  testCases.forEach(({ mode, txnType, description }) => {
    it(description, async () => {
      useInitiativeAgreement.mockReturnValueOnce({
        data: {
          currentStatus: { status: TRANSACTION_STATUSES.DRAFT },
          history: [],
          govComment: 'Test comment',
          toOrganizationId: '123',
          complianceUnits: '10',
          transactionEffectiveDate: '2024-01-01',
        },
        isLoading: false,
        isFetched: true,
        isLoadingError: false,
      })

      renderComponent(mode, txnType)

      if (mode === 'add') {
        expect(screen.getByText('txn:newTransaction')).toBeInTheDocument()
      } else if (mode === 'edit') {
        expect(screen.getByText(`${txnType}:${txnType}`)).toBeInTheDocument()
      }

      await waitFor(() => {
        expect(screen.getByText(`${txnType}:${txnType}`)).toBeInTheDocument()
      })
    })
  })
})
