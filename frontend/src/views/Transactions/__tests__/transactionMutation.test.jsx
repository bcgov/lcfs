import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { useTransactionMutation } from '../transactionMutation'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import {
  ADMIN_ADJUSTMENT,
  INITIATIVE_AGREEMENT
} from '@/views/Transactions/constants'
import { ROUTES, buildPath } from '@/routes/routes'

let navigate

// Mock necessary functions
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate
  }
})

const renderComponent = (HookComponent) => {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>{HookComponent}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('useTransactionMutation', () => {
  const t = vi.fn((key) => key)
  const setAlertMessage = vi.fn()
  const setAlertSeverity = vi.fn()
  const setModalData = vi.fn()
  const alertRef = { current: { triggerAlert: vi.fn() } }
  const queryClient = { invalidateQueries: vi.fn() }

  beforeEach(() => {
    navigate = vi.fn()
    window.scrollTo = vi.fn()
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom')
      return {
        ...actual,
        useNavigate: () => navigate
      }
    })
  })

  afterAll(() => {
    vi.clearAllMocks()
  })

  it('should navigate to edit route if status is DRAFT and no recommended history', () => {
    const HookComponent = () => {
      const { handleSuccess } = useTransactionMutation(
        t,
        setAlertMessage,
        setAlertSeverity,
        setModalData,
        alertRef,
        queryClient
      )
      return (
        <button
          onClick={() =>
            handleSuccess(
              {
                data: {
                  currentStatus: { status: TRANSACTION_STATUSES.DRAFT },
                  initiativeAgreementId: '123',
                  history: []
                }
              },
              '123',
              INITIATIVE_AGREEMENT
            )
          }
        >
          Test
        </button>
      )
    }

    renderComponent(<HookComponent />)

    fireEvent.click(screen.getByText('Test'))

    const expectedPath = buildPath(
      ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.EDIT,
      {
        transactionId: '123'
      }
    )
    expect(navigate).toHaveBeenCalledWith(expectedPath, {
      state: {
        message: 'initiativeAgreement:actionMsgs.updatedText',
        severity: 'success'
      }
    })
  })

  it('should navigate to TRANSACTIONS with hid if status is DRAFT and isReturned is true', () => {
    const HookComponent = () => {
      const { handleSuccess } = useTransactionMutation(
        t,
        setAlertMessage,
        setAlertSeverity,
        setModalData,
        alertRef,
        queryClient
      )
      return (
        <button
          onClick={() =>
            handleSuccess(
              {
                data: {
                  currentStatus: { status: TRANSACTION_STATUSES.DRAFT },
                  initiativeAgreementId: '123',
                  returned: true
                }
              },
              '123',
              INITIATIVE_AGREEMENT
            )
          }
        >
          Test
        </button>
      )
    }

    renderComponent(<HookComponent />)

    fireEvent.click(screen.getByText('Test'))

    expect(navigate).toHaveBeenCalledWith(
      '/transactions/?hid=initiativeagreement-123',
      {
        state: {
          message: 'initiativeAgreement:actionMsgs.successText',
          severity: 'success'
        }
      }
    )
  })

  it('should navigate to TRANSACTIONS with hid if status is RECOMMENDED or APPROVED', () => {
    const HookComponent = () => {
      const { handleSuccess } = useTransactionMutation(
        t,
        setAlertMessage,
        setAlertSeverity,
        setModalData,
        alertRef,
        queryClient
      )
      return (
        <button
          onClick={() =>
            handleSuccess(
              {
                data: {
                  currentStatus: { status: TRANSACTION_STATUSES.RECOMMENDED },
                  initiativeAgreementId: '123'
                }
              },
              '123',
              INITIATIVE_AGREEMENT
            )
          }
        >
          Test
        </button>
      )
    }

    renderComponent(<HookComponent />)

    fireEvent.click(screen.getByText('Test'))

    expect(navigate).toHaveBeenCalledWith(
      '/transactions/?hid=initiativeagreement-123',
      {
        state: {
          message: 'initiativeAgreement:actionMsgs.successText',
          severity: 'success'
        }
      }
    )
  })

  it('should navigate to TRANSACTIONS if status is DELETED', () => {
    const HookComponent = () => {
      const { handleSuccess } = useTransactionMutation(
        t,
        setAlertMessage,
        setAlertSeverity,
        setModalData,
        alertRef,
        queryClient
      )
      return (
        <button
          onClick={() =>
            handleSuccess(
              {
                data: {
                  currentStatus: { status: TRANSACTION_STATUSES.DELETED },
                  initiativeAgreementId: '123'
                }
              },
              '123',
              INITIATIVE_AGREEMENT
            )
          }
        >
          Test
        </button>
      )
    }

    renderComponent(<HookComponent />)

    fireEvent.click(screen.getByText('Test'))

    expect(navigate).toHaveBeenCalledWith('/transactions', {})
  })

  it('should set alert message and severity for other statuses', () => {
    const HookComponent = () => {
      const { handleSuccess } = useTransactionMutation(
        t,
        setAlertMessage,
        setAlertSeverity,
        setModalData,
        alertRef,
        queryClient
      )
      return (
        <button
          onClick={() =>
            handleSuccess(
              {
                data: {
                  currentStatus: { status: 'OTHER_STATUS' },
                  initiativeAgreementId: '123'
                }
              },
              '123',
              INITIATIVE_AGREEMENT
            )
          }
        >
          Test
        </button>
      )
    }

    renderComponent(<HookComponent />)

    fireEvent.click(screen.getByText('Test'))

    expect(setAlertSeverity).toHaveBeenCalledWith('success')
    expect(alertRef.current.triggerAlert).toHaveBeenCalled()
  })
})
