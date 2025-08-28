import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Mock all external dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    reset: vi.fn(),
    getValues: () => 1,
    watch: () => null,
    handleSubmit: () => () => {}
  }),
  FormProvider: ({ children }) => <div data-test="form-provider">{children}</div>
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
  buildPath: (route, params) => route.replace(':transferId', params.transferId)
}))

// Mock child components
vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => <div data-test="bc-typography" {...props}>{children}</div>
}))

vi.mock('@/components/BCAlert', () => ({
  default: React.forwardRef(({ children, ...props }, ref) => (
    <div data-test="bc-alert" ref={ref} {...props}>{children}</div>
  ))
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => <div data-test="bc-box" {...props}>{children}</div>
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, ...props }) => <button data-test="bc-button" {...props}>{children}</button>
}))

vi.mock('@/components/BCModal', () => ({
  default: ({ children, ...props }) => <div data-test="bc-modal" {...props}>{children}</div>
}))

vi.mock('@/components/Loading', () => ({
  default: ({ message }) => <div data-test="loading">{message}</div>
}))

vi.mock('@/components/Role', () => ({
  Role: ({ children }) => <div data-test="role">{children}</div>
}))

vi.mock('@/views/Transfers/components', () => ({
  AgreementDate: () => <div data-test="agreement-date">AgreementDate</div>,
  Comments: () => <div data-test="comments">Comments</div>,
  TransferDetails: () => <div data-test="transfer-details">TransferDetails</div>,
  TransferGraphic: () => <div data-test="transfer-graphic">TransferGraphic</div>,
  TransferView: () => <div data-test="transfer-view">TransferView</div>
}))

vi.mock('../components/CategoryCheckbox', () => ({
  CategoryCheckbox: () => <div data-test="category-checkbox">CategoryCheckbox</div>
}))

vi.mock('../components/Recommendation', () => ({
  Recommendation: () => <div data-test="recommendation">Recommendation</div>
}))

vi.mock('../components/SigningAuthority', () => ({
  default: () => <div data-test="signing-authority">SigningAuthority</div>
}))

vi.mock('@/components/InternalComments', () => ({
  default: () => <div data-test="internal-comments">InternalComments</div>
}))

vi.mock('../_schema', () => ({
  AddEditTransferSchema: {}
}))

vi.mock('../buttonConfigs', () => ({
  buttonClusterConfigFn: vi.fn()
}))

import { AddEditViewTransfer } from '../AddEditViewTransfer'
import { useLocation, useMatches, useNavigate, useParams } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRegExtOrgs } from '@/hooks/useOrganizations'
import { useTransfer, useCreateUpdateTransfer } from '@/hooks/useTransfer'
import { useQueryClient } from '@tanstack/react-query'
import { buttonClusterConfigFn } from '../buttonConfigs'
import { TRANSFER_STATUSES } from '@/constants/statuses'

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
    useNavigate.mockReturnValue(mockNavigate)
    useLocation.mockReturnValue({ state: null })
    useMatches.mockReturnValue([{ handle: { mode: 'view' } }])
    useParams.mockReturnValue({ transferId: null })
    useQueryClient.mockReturnValue(mockQueryClient)
    
    useCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 1 },
        isGovernmentUser: false,
        roles: []
      },
      hasRoles: vi.fn().mockReturnValue(false),
      hasAnyRole: vi.fn().mockReturnValue(false)
    })
    
    useRegExtOrgs.mockReturnValue({ data: [] })
    
    useTransfer.mockReturnValue({
      data: null,
      isLoading: false,
      isFetched: false,
      isLoadingError: false
    })
    
    useCreateUpdateTransfer.mockReturnValue({
      mutate: mockMutate,
      isPending: false
    })
    
    mockQueryClient.getQueryState.mockReturnValue({ status: 'success' })
    buttonClusterConfigFn.mockReturnValue({ New: [] })
  })

  it('renders loading state when transfer data is loading', () => {
    useParams.mockReturnValue({ transferId: '123' })
    useTransfer.mockReturnValue({
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
    useParams.mockReturnValue({ transferId: '123' })
    mockQueryClient.getQueryState.mockReturnValue({ status: 'pending' })
    
    renderComponent()
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('renders updating state', () => {
    useCreateUpdateTransfer.mockReturnValue({
      mutate: mockMutate,
      isPending: true
    })
    
    renderComponent()
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.getByText('transfer:processingText')).toBeInTheDocument()
  })

  it('renders add mode correctly', () => {
    useMatches.mockReturnValue([{ handle: { mode: 'add' } }])
    useCurrentUser.mockReturnValue({
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
    useParams.mockReturnValue({ transferId: '123' })
    
    renderComponent()
    expect(screen.getByTestId('transfer-view')).toBeInTheDocument()
  })

  it('renders stepper with basic data', () => {
    useTransfer.mockReturnValue({
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
    useCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 1 },
        isGovernmentUser: false
      },
      hasRoles: vi.fn().mockReturnValue(false),
      hasAnyRole: vi.fn().mockReturnValue(true)
    })
    useTransfer.mockReturnValue({
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
    buttonClusterConfigFn.mockReturnValue({ New: [null] })
    renderComponent()
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument()
  })

  it('generates correct title for view mode', () => {
    useParams.mockReturnValue({ transferId: '456' })
    renderComponent()
    expect(screen.getByText('transfer:transferID CT456')).toBeInTheDocument()
  })

  it('prevents editor mode without proper permissions', () => {
    useMatches.mockReturnValue([{ handle: { mode: 'edit' } }])
    useCurrentUser.mockReturnValue({
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
    useCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 1 },
        isGovernmentUser: true
      },
      hasRoles: vi.fn().mockReturnValue(false),
      hasAnyRole: vi.fn().mockReturnValue(false)
    })
    
    useTransfer.mockReturnValue({
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
    useTransfer.mockReturnValue({
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