import { useNavigate } from 'react-router-dom'
import type { QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'
import { ROUTES, buildPath } from '@/routes/routes'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import {
  ADMIN_ADJUSTMENT,
  INITIATIVE_AGREEMENT,
  type TransactionKind
} from '@/views/Transactions/constants'

type TransactionId = string | number
type MutationData = {
  currentStatus: { status: string }
  returned?: boolean
}
type AdminAdjustmentResponse = {
  data: MutationData & { adminAdjustmentId: TransactionId }
}
type InitiativeAgreementResponse = {
  data: MutationData & { initiativeAgreementId: TransactionId }
}
type SuccessArguments =
  | [
      AdminAdjustmentResponse,
      TransactionId | null | undefined,
      typeof ADMIN_ADJUSTMENT
    ]
  | [
      InitiativeAgreementResponse,
      TransactionId | null | undefined,
      typeof INITIATIVE_AGREEMENT
    ]
type MutationError = { response?: { data?: { detail?: string } } }
type Translate = (key: string, options?: { status: string }) => string
type AlertHandle = { triggerAlert: () => void }

export const useTransactionMutation = (
  t: Translate,
  setAlertMessage: (message: string) => void,
  setAlertSeverity: (severity: 'success' | 'error') => void,
  setModalData: (data: null) => void,
  alertRef: RefObject<AlertHandle | null>,
  queryClient: Pick<QueryClient, 'invalidateQueries'>
) => {
  const navigate = useNavigate()

  // Helper function to determine routes based on transaction type and ID
  const getTransactionRoutes = (
    transactionType: TransactionKind,
    id: TransactionId
  ) => {
    const typeRoutes = {
      [ADMIN_ADJUSTMENT]: {
        editRoute: ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.EDIT,
        viewRoute: ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.VIEW
      },
      [INITIATIVE_AGREEMENT]: {
        editRoute: ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.EDIT,
        viewRoute: ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.VIEW
      }
    }

    return {
      editRoute: typeRoutes[transactionType].editRoute.replace(
        ':transactionId',
        String(id)
      ),
      viewRoute: typeRoutes[transactionType].viewRoute.replace(
        ':transactionId',
        String(id)
      )
    }
  }

  const handleSuccess = (
    ...[response, transactionId, transactionType]: SuccessArguments
  ) => {
    setModalData(null)
    const status = response.data.currentStatus.status
    const idPrefix =
      transactionType === ADMIN_ADJUSTMENT
        ? 'adminadjustment-'
        : 'initiativeagreement-'
    const txnId =
      transactionType === ADMIN_ADJUSTMENT
        ? response.data.adminAdjustmentId
        : response.data.initiativeAgreementId
    const { editRoute } = getTransactionRoutes(transactionType, txnId)

    // Check if returned flag is true
    const isReturned = response.data.returned

    // Invalidate relevant queries
    queryClient.invalidateQueries({
      queryKey: [transactionType, transactionId]
    })

    // Set the message and state for navigating
    const message = t(
      `${transactionType}:actionMsgs.${
        transactionId ? 'updatedText' : 'createdText'
      }`
    )
    const navigateState = {
      state: { message, severity: 'success' }
    }

    if (status === TRANSACTION_STATUSES.DRAFT && !isReturned) {
      navigate(editRoute, navigateState)
    } else if (status === TRANSACTION_STATUSES.DRAFT && isReturned) {
      navigate(
        buildPath(ROUTES.TRANSACTIONS.LIST_HIGHLIGHTED, {
          hid: `${idPrefix}${txnId}`
        }),
        {
          state: {
            message: t(`${transactionType}:actionMsgs.successText`, {
              status: 'returned'
            }),
            severity: 'success'
          }
        }
      )
    } else if (
      status === TRANSACTION_STATUSES.RECOMMENDED ||
      status === TRANSACTION_STATUSES.APPROVED
    ) {
      navigate(
        buildPath(ROUTES.TRANSACTIONS.LIST_HIGHLIGHTED, {
          hid: `${idPrefix}${txnId}`
        }),
        {
          state: {
            message: t(`${transactionType}:actionMsgs.successText`, {
              status: response.data.currentStatus.status.toLowerCase()
            }),
            severity: 'success'
          }
        }
      )
    } else if (status === TRANSACTION_STATUSES.DELETED) {
      navigate(ROUTES.TRANSACTIONS.LIST, {})
    } else {
      setAlertMessage(
        t(`${transactionType}:actionMsgs.successText`, { status: 'saved' })
      )
      setAlertSeverity('success')
    }

    if (alertRef?.current) {
      alertRef.current!.triggerAlert()
    }
    window.scrollTo(0, 0)
  }

  const handleError = (
    _error: MutationError,
    transactionId: TransactionId | null | undefined,
    transactionType: TransactionKind
  ) => {
    setModalData(null)
    const errorMsg =
      _error.response?.data?.detail ||
      t(
        `${transactionType}:actionMsgs.error${
          transactionId ? 'Update' : 'Create'
        }Text`
      )
    setAlertMessage(errorMsg)
    setAlertSeverity('error')
    alertRef.current!.triggerAlert()
    window.scrollTo(0, 0)
  }

  return { handleSuccess, handleError }
}
