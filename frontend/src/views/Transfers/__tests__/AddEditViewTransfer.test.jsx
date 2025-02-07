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

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn().mockReturnValue({
    t: vi.fn((key) => key)
  })
}))

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

describe.skip('AddEditViewTransfer Component Tests', () => {
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

    it('renders the correct total value with decimal pricePerUnit', async () => {
      render(<AddEditViewTransfer />, { wrapper })

      const quantityInput = await screen.findByTestId('quantity')
      const priceInput = await screen.findByTestId('price-per-unit')
      const totalValueDisplay = await screen.findByTestId(
        'transfer-total-value'
      )

      // Simulate entering values
      await userEvent.clear(quantityInput)
      await userEvent.type(quantityInput, '5')
      await userEvent.clear(priceInput)
      await userEvent.type(priceInput, '3.99')

      await waitFor(() => {
        expect(totalValueDisplay).toHaveTextContent('$19.95 CAD.')
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

      const buttonClusterBackButton = await screen.findByTestId(
        'button-cluster-back'
      )
      const buttonClusterSaveButton =
        await screen.findByTestId('save-draft-btn')
      const buttonClusterSignButton =
        await screen.findByTestId('sign-and-send-btn')

      expect(buttonClusterBackButton).toBeInTheDocument()
      expect(buttonClusterSaveButton).toBeInTheDocument()
      expect(buttonClusterSignButton).toBeInTheDocument()
    })
    it('doesnt render the signing if user does not have permissions', async () => {
      useCurrentUser.mockReturnValue({
        data: {
          roles: [{ name: roles.supplier }, { name: roles.transfers }],
          isGovernmentUser: false,
          organization: {
            organizationId: 1
          }
        },
        hasRoles: vi.fn().mockReturnValue(true),
        hasAnyRole: vi.fn().mockReturnValue(true),
        sameOrganization: vi.fn().mockReturnValue(false)
      })

      render(<AddEditViewTransfer />, { wrapper })
      const signingAuthority = screen.queryByTestId('signing-authority')
      expect(signingAuthority).not.toBeInTheDocument()
    })
  })
  describe('When in edit mode', async () => {
    beforeEach(() => {
      useMatches.mockReturnValue([{ handle: { mode: 'edit' } }])
      useParams.mockReturnValue({
        transferId: 1
      })
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.DRAFT },
          comments: [{ name: 'john doe' }],
          fromOrganization: { name: 'from Org', organizationId: 1 }
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

      const buttonClusterBackButton = await screen.findByTestId(
        'button-cluster-back'
      )
      const buttonClusterDeleteButton =
        await screen.findByTestId('delete-draft-btn')
      const buttonClusterSaveButton =
        await screen.findByTestId('save-draft-btn')
      const buttonClusterSignButton =
        await screen.findByTestId('sign-and-send-btn')

      expect(buttonClusterBackButton).toBeInTheDocument()
      expect(buttonClusterDeleteButton).toBeInTheDocument()
      expect(buttonClusterSaveButton).toBeInTheDocument()
      expect(buttonClusterSignButton).toBeInTheDocument()
    })

    it('should not reset the comment field when the signing authority checkbox is toggled', async () => {
      // Setup mocks and data
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
          transferHistory: []
        },
        isFetched: true,
        isLoadingError: false
      })
      useLocation.mockReturnValue({
        state: null
      })

      render(<AddEditViewTransfer />, { wrapper })

      const commentField = await screen.findByTestId('external-comments')

      // Target the actual input within the MUI TextField
      const commentInput = within(commentField).getByRole('textbox')

      // Simulate entering text into the comment field
      await userEvent.type(commentInput, 'Test comment')
      await waitFor(() => {
        expect(commentInput).toHaveValue('Test comment')
      })

      // Toggle the signing authority checkbox
      const signingAuthorityCheckbox = await screen.findByTestId(
        'signing-authority-checkbox'
      )
      await userEvent.click(signingAuthorityCheckbox)

      // Verify that the comment field still has the same value
      await waitFor(() => {
        expect(commentInput).toHaveValue('Test comment')
      })
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
      //   useCreateUpdateTransfer.mockReturnValue({
      //     mutate: vi.fn()
      //   })
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
      const transferDetailsCard = await screen.findByTestId(
        'transfer-details-card'
      )
      const commentList = await screen.findByTestId('comment-list')

      expect(stepper).toBeInTheDocument()
      expect(transferDetailsCard).toBeInTheDocument()
      expect(commentList).toBeInTheDocument()
    })
    it('renders the correct button components (sent status & signing auth)', async () => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.SENT },
          comments: [{ name: 'john doe' }],
          fromOrganization: { name: 'from Org' },
          transferHistory: [],
          toOrganization: { organizationId: 1 }
        }
      })
      render(<AddEditViewTransfer />, { wrapper })
      const buttonClusterBackButton = await screen.findByTestId(
        'button-cluster-back'
      )
      const buttonClusterDeclineButton =
        await screen.findByTestId('decline-btn')
      const buttonClusterSignButton = await screen.findByTestId(
        'sign-and-submit-btn'
      )
      const buttonClusterRescindButton =
        await screen.findByTestId('rescind-btn')

      expect(buttonClusterBackButton).toBeInTheDocument()
      expect(buttonClusterDeclineButton).toBeInTheDocument()
      expect(buttonClusterSignButton).toBeInTheDocument()
      expect(buttonClusterRescindButton).toBeInTheDocument()
    })
    it('renders the correct button components (Submitted status & signing auth)', async () => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
          comments: [{ name: 'john doe' }],
          fromOrganization: { name: 'from Org' },
          transferHistory: [],
          toOrganization: { organizationId: 1 }
        }
      })

      render(<AddEditViewTransfer />, { wrapper })

      const buttonClusterBackButton = await screen.findByTestId(
        'button-cluster-back'
      )
      const buttonClusterRescindButton =
        await screen.findByTestId('rescind-btn')

      expect(buttonClusterBackButton).toBeInTheDocument()
      expect(buttonClusterRescindButton).toBeInTheDocument()
    })
    it('renders the correct button components (Recommended status & director)', async () => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.SENT },
          comments: [{ name: 'john doe' }],
          fromOrganization: { name: 'from Org' },
          transferHistory: [],
          toOrganization: { organizationId: 1 }
        }
      })
      useCurrentUser.mockReturnValue({
        data: {
          roles: [{ name: roles.director }],
          isGovernmentUser: true,
          organization: {
            organizationId: 1
          }
        },
        hasRoles: vi.fn().mockReturnValue(true),
        hasAnyRole: vi.fn().mockReturnValue(true),
        sameOrganization: vi.fn().mockReturnValue(false)
      })

      render(<AddEditViewTransfer />, { wrapper })

      const buttonClusterBackButton = await screen.findByTestId(
        'button-cluster-back'
      )
      const buttonClusterRescindButton =
        await screen.findByTestId('rescind-btn')

      expect(buttonClusterBackButton).toBeInTheDocument()
      expect(buttonClusterRescindButton).toBeInTheDocument()
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
    it('renders the alert box when alert severity state is not present', async () => {
      useLocation.mockReturnValue({
        state: {
          message: 'alert'
        }
      })

      render(<AddEditViewTransfer />, { wrapper })

      const alertBox = await screen.findByTestId('alert-box')

      expect(alertBox).toBeInTheDocument()
    })
    it('renders the alert box when there is a loading error', async () => {
      useTransfer.mockReturnValue({
        // data: {
        //   currentStatus: { status: TRANSFER_STATUSES.DRAFT },
        //   comments: [{ name: 'john doe' }],
        //   fromOrganization: { name: 'from Org' },
        //   transferHistory: []
        // },
        isLoadingError: true
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

    it('enables "Recommend" button when recommendation is selected', async () => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: TRANSFER_STATUSES.SUBMITTED },
          comments: [],
          fromOrganization: { name: 'from Org', organizationId: 2 },
          transferHistory: [],
          toOrganization: { organizationId: 2 }
        },
        isFetched: true,
        isLoadingError: false
      })
      useCurrentUser.mockReturnValue({
        data: {
          roles: [{ name: roles.analyst }],
          isGovernmentUser: true,
          organization: { organizationId: 1 }
        },
        hasRoles: vi.fn().mockReturnValue(true),
        hasAnyRole: vi.fn().mockReturnValue(true),
        sameOrganization: vi.fn().mockReturnValue(false)
      })
      useLocation.mockReturnValue({ state: null })

      render(<AddEditViewTransfer />, { wrapper })

      // Find the "Recommend" button
      const recommendButton = await screen.findByTestId('recommend-btn')

      // Assert that the button is disabled
      expect(recommendButton).toBeDisabled()

      // Simulate selecting a recommendation
      const recommendRecordRadio = screen.getByTestId('recommend-record-radio')
      await userEvent.click(recommendRecordRadio)

      // Assert that the button is now enabled
      expect(recommendButton).toBeEnabled()
    })
  })
})
