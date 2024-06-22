import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useCreateUpdateTransfer, useTransfer } from '@/hooks/useTransfer'
import theme from '@/themes'
import { ThemeProvider, useMediaQuery } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import {
  MemoryRouter,
  useLocation,
  useMatches,
  useParams
} from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AddEditViewTransfer } from '../AddEditViewTransfer'
import * as transferHooks from '@/hooks/useTransfer'

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

const createMutate = vi.fn()
const updateMutate = vi.fn()

vi.mock('@/hooks/useTransfer', async () => ({
  useCreateUpdateTransfer: vi.fn(() => ({
    mutate: createMutate,
    isPending: false
  })),
  useTransfer: vi.fn().mockReturnValue({
    data: {}
  }),
  useUpdateCategory: vi.fn(() => ({ mutate: updateMutate }))
}))

const renderComponent = (handleMode = 'edit') => {
  const queryClient = new QueryClient()
  queryClient.getQueryState = vi.fn().mockReturnValue({
    status: 'success'
  })

  useTranslation.mockReturnValue({ t: vi.fn((key) => key) })

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <AddEditViewTransfer />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('AddEditViewTransfer Component Tests', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })
  it('renders loading when transfer data is loading', async () => {
    useMatches.mockReturnValue([{ handle: { mode: 'add' } }])
    useParams.mockReturnValue({
      transferId: 1
    })
    useTransfer.mockReturnValue({
      isLoading: true
    })
    useLocation.mockReturnValue({
      state: null
    })

    renderComponent()

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

    renderComponent()

    const loading = screen.getByTestId('loading')
    expect(loading).toBeInTheDocument()
  })
  describe('When in add mode', async () => {
    beforeEach(() => {
      useMatches.mockReturnValue([{ handle: { mode: 'add' } }])
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: '' },
          comments: [{ name: 'john doe' }]
        }
      })

      useLocation.mockReturnValue({
        state: null
      })
    })

    it('renders without crashing', () => {
      renderComponent()
    })

    it('renders the correct components', async () => {
      renderComponent()
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

      renderComponent()
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
          currentStatus: { status: 'Draft' },
          comments: [{ name: 'john doe' }],
          fromOrganization: { name: 'from Org', organizationId: 1 }
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
      renderComponent()
    })
    it('renders the correct components', async () => {
      renderComponent()
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
  })
  describe('When in view mode', async () => {
    beforeEach(() => {
      useMatches.mockReturnValue([{ handle: { mode: 'view' } }])
      useParams.mockReturnValue({
        transferId: 1
      })
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: 'Draft' },
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
      renderComponent()
    })
    it('renders the correct components', async () => {
      renderComponent()
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
          currentStatus: { status: 'Sent' },
          comments: [{ name: 'john doe' }],
          fromOrganization: { name: 'from Org' },
          transferHistory: [],
          toOrganization: { organizationId: 1 }
        }
      })
      renderComponent()
      const buttonClusterBackButton = await screen.findByTestId(
        'button-cluster-back'
      )
      const buttonClusterDeclineButton =
        await screen.findByTestId('decline-btn')
      const buttonClusterSignButton = await screen.findByTestId(
        'sign-and-submit-btn'
      )
      const buttonClusterRecindButton = await screen.findByTestId('rescind-btn')

      expect(buttonClusterBackButton).toBeInTheDocument()
      expect(buttonClusterDeclineButton).toBeInTheDocument()
      expect(buttonClusterSignButton).toBeInTheDocument()
      expect(buttonClusterRecindButton).toBeInTheDocument()
    })
    it('renders the correct button components (Submitted status & signing auth)', async () => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: 'Submitted' },
          comments: [{ name: 'john doe' }],
          fromOrganization: { name: 'from Org' },
          transferHistory: [],
          toOrganization: { organizationId: 1 }
        }
      })

      renderComponent()

      const buttonClusterBackButton = await screen.findByTestId(
        'button-cluster-back'
      )
      const buttonClusterRecindButton = await screen.findByTestId('rescind-btn')

      expect(buttonClusterBackButton).toBeInTheDocument()
      expect(buttonClusterRecindButton).toBeInTheDocument()
    })
    it('renders the correct button components (Recommended status & director)', async () => {
      useTransfer.mockReturnValue({
        data: {
          currentStatus: { status: 'Sent' },
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

      renderComponent()

      const buttonClusterBackButton = await screen.findByTestId(
        'button-cluster-back'
      )
      const buttonClusterRecindButton = await screen.findByTestId('rescind-btn')

      expect(buttonClusterBackButton).toBeInTheDocument()
      expect(buttonClusterRecindButton).toBeInTheDocument()
    })
    it('renders the alert box when alert severity state is present', async () => {
      useLocation.mockReturnValue({
        state: {
          message: 'alert',
          severity: 'error'
        }
      })

      renderComponent()

      const alertBox = await screen.findByTestId('alert-box')

      expect(alertBox).toBeInTheDocument()
    })
    it('renders the alert box when alert severity state is not present', async () => {
      useLocation.mockReturnValue({
        state: {
          message: 'alert'
        }
      })

      renderComponent()

      const alertBox = await screen.findByTestId('alert-box')

      expect(alertBox).toBeInTheDocument()
    })
    it('renders the alert box when there is a loading error', async () => {
      useTransfer.mockReturnValue({
        // data: {
        //   currentStatus: { status: 'Draft' },
        //   comments: [{ name: 'john doe' }],
        //   fromOrganization: { name: 'from Org' },
        //   transferHistory: []
        // },
        isLoadingError: true
      })

      renderComponent()

      const alertBox = await screen.findByTestId('alert-box')

      expect(alertBox).toBeInTheDocument()
    })
    it('does not render if transferData is null/undefined', async () => {
      useTransfer.mockReturnValue({
        data: null
      })

      expect(() => renderComponent()).toThrow()
    })
    it('renders vertical stepper on mobile size', async () => {
      useMediaQuery.mockReturnValue(true)
      renderComponent()

      const stepper = await screen.findByTestId('stepper')

      expect(stepper).toBeInTheDocument()
      expect(stepper).toHaveClass('MuiStepper-vertical')
    })
  })
})
