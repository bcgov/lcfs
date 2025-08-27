import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import * as useTransferHooks from '@/hooks/useTransfer'
import { useCreateUpdateTransfer, useTransfer } from '@/hooks/useTransfer'
import { useMediaQuery } from '@mui/material'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation, useMatches, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AddEditViewTransfer } from '../AddEditViewTransfer'
import { TRANSFER_STATUSES } from '@/constants/statuses'
import { useRegExtOrgs } from '@/hooks/useOrganizations'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    data: {
      roles: [
        { name: roles.supplier },
        { name: roles.transfers },
        { name: roles.signing_authority }
      ],
      isGovernmentUser: false,
      organization: {
        organizationId: 1
      }
    },
    hasRoles: vi.fn().mockReturnValue(true),
    hasAnyRole: vi.fn().mockReturnValue(true),
    sameOrganization: vi.fn().mockReturnValue(false)
  }))
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material')
  return {
    ...actual,
    useMediaQuery: vi.fn()
  }
})

vi.mock('@hookform/resolvers/yup', () => ({
  yupResolver: vi.fn()
}))

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: vi.fn(() => ({ transactionId: '1' })),
    useNavigate: () => navigate,
    useLocation: vi.fn(),
    useMatches: vi.fn()
  }
})

vi.mock('@/hooks/useTransfer')

vi.mock('@/hooks/useOrganizations', () => ({
  useRegExtOrgs: vi.fn()
}))

vi.mock('@/hooks/useOrganization', () => ({
  useCurrentOrgBalance: vi.fn(() => ({
    data: { balance: 1000, reserved: 100 },
    isLoading: false
  }))
}))

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: vi.fn(() => ({
    setForbidden: vi.fn(),
    isAuthorized: vi.fn().mockReturnValue(true),
    roles: ['supplier', 'transfers', 'signing_authority']
  }))
}))

describe('AddEditViewTransfer Component Tests', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })
  beforeEach(() => {
    vi.mocked(useTransferHooks.useCreateUpdateTransfer).mockReturnValue({
      mutate: vi.fn(),
      isPending: false
    })
    vi.mocked(useTransferHooks.useUpdateCategory).mockReturnValue({
      mutate: vi.fn(),
      isPending: false
    })
    useRegExtOrgs.mockReturnValue({
      data: [
        { organizationId: 1, name: 'Org One' },
        { organizationId: 2, name: 'Org Two' }
      ]
    })
  })
  it('renders loading when transfer data is loading', async () => {
    useMatches.mockReturnValue([{ handle: { mode: 'add' } }])
    useParams.mockReturnValue({
      transferId: 1
    })
    vi.mocked(useTransferHooks.useTransfer).mockReturnValue({
      isLoading: true
    })
    useLocation.mockReturnValue({
      state: null
    })

    render(<AddEditViewTransfer />, { wrapper })

    const loading = screen.getByTestId('loading')
    expect(loading).toBeInTheDocument()
  })
  it('renders loading when transfer data is updating', async () => {
    useMatches.mockReturnValue([{ handle: { mode: 'edit' } }])
    useParams.mockReturnValue({
      transferId: 1
    })
    useTransfer.mockReturnValue({
      data: {
        currentStatus: { status: '' },
        comments: [{ name: 'john doe' }]
      }
    })
    useCreateUpdateTransfer.mockReturnValue({
      mutate: vi.fn(),
      isPending: true
    })
    useLocation.mockReturnValue({
      state: null
    })

    render(<AddEditViewTransfer />, { wrapper })

    const loading = screen.getByTestId('loading')
    expect(loading).toBeInTheDocument()
  })
  it('handles decimal pricePerUnit values correctly', async () => {
    useMatches.mockReturnValue([{ handle: { mode: 'edit' } }])
    useParams.mockReturnValue({
      transferId: 1
    })
    useTransfer.mockReturnValue({
      data: {
        currentStatus: { status: TRANSFER_STATUSES.DRAFT },
        comments: [{ name: 'john doe' }],
        fromOrganization: { name: 'from Org', organizationId: 1 },
        toOrganization: { name: 'to Org', organizationId: 2 },
        pricePerUnit: 5.75,
        quantity: 10,
        transferHistory: []
      },
      isFetched: true,
      isLoadingError: false
    })
    useLocation.mockReturnValue({
      state: null
    })

    render(<AddEditViewTransfer />, { wrapper })

    const totalValueDisplay = await screen.findByTestId('transfer-total-value')

    await waitFor(() => {
      expect(totalValueDisplay).toHaveTextContent('$57.50 CAD.')
    })
  })

  describe('When in add mode', () => {
    beforeEach(() => {
      useMatches.mockReturnValue([{ handle: { mode: 'add' } }])
      useTransfer.mockReturnValue({
        data: null,
        isLoading: false,
        isFetched: true,
        isLoadingError: false
      })

      useLocation.mockReturnValue({
        state: null
      })
    })

    it('renders without crashing', () => {
      render(<AddEditViewTransfer />, { wrapper })
    })

    it('renders the correct components', async () => {
      render(<AddEditViewTransfer />, { wrapper })
      const stepper = await screen.findByTestId('stepper')
      const transferGraphic = await screen.findByTestId('transfer-graphic')
      const transferDetails = await screen.findByTestId('transfer-details')
      const agreementDate = await screen.findByTestId('agreement-date')
      const comments = await screen.findByTestId('comments')
      const signingAuthority = await screen.findByTestId('signing-authority')

      expect(stepper).toBeInTheDocument()
      expect(transferGraphic).toBeInTheDocument()
      expect(transferDetails).toBeInTheDocument()
      expect(agreementDate).toBeInTheDocument()
      expect(comments).toBeInTheDocument()
      expect(signingAuthority).toBeInTheDocument()
    })

    it('renders back button', async () => {
      render(<AddEditViewTransfer />, { wrapper })
      const buttonClusterBackButton = await screen.findByTestId('button-cluster-back')
      expect(buttonClusterBackButton).toBeInTheDocument()
    })

    it('renders form', () => {
      render(<AddEditViewTransfer />, { wrapper })
      const form = screen.getByTestId('new-transfer-form')
      expect(form).toBeInTheDocument()
    })
  })

  describe('When in view mode', async () => {
    beforeEach(() => {
      useMatches.mockReturnValue([{ handle: { mode: 'view' } }])
      useParams.mockReturnValue({
        transferId: 1
      })
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.DRAFT },
          comments: [{ name: 'john doe' }],
          fromOrganization: { name: 'from Org' },
          transferHistory: []
        }
      })
      useLocation.mockReturnValue({
        state: null
      })
    })
    it('renders without crashing', () => {
      render(<AddEditViewTransfer />, { wrapper })
    })
    it('renders the correct components', async () => {
      render(<AddEditViewTransfer />, { wrapper })
      const stepper = await screen.findByTestId('stepper')
      const transferDetailsCard = await screen.findByTestId('transfer-details-card')
      const commentList = await screen.findByTestId('comment-list')

      expect(stepper).toBeInTheDocument()
      expect(transferDetailsCard).toBeInTheDocument()
      expect(commentList).toBeInTheDocument()
    })

    it('renders the alert box when alert severity state is present', async () => {
      useLocation.mockReturnValue({
        state: {
          message: 'alert',
          severity: 'error'
        }
      })

      render(<AddEditViewTransfer />, { wrapper })

      const alertBox = await screen.findByTestId('alert-box')

      expect(alertBox).toBeInTheDocument()
    })

    it('renders vertical stepper on mobile size', async () => {
      useMediaQuery.mockReturnValue(true)
      render(<AddEditViewTransfer />, { wrapper })

      const stepper = await screen.findByTestId('stepper')

      expect(stepper).toBeInTheDocument()
      expect(stepper).toHaveClass('MuiStepper-vertical')
    })

    it('shows effective text for non-recorded transfers', async () => {
      render(<AddEditViewTransfer />, { wrapper })
      
      const effectiveText = await screen.findByText('transfer:effectiveText')
      const considerationText = await screen.findByText('transfer:considerationText')
      
      expect(effectiveText).toBeInTheDocument()
      expect(considerationText).toBeInTheDocument()
    })
  })
})
