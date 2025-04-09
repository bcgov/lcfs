import { useNavigate } from 'react-router-dom'
import { ROUTES, buildPath } from '@/routes/routes'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import {
  ADMIN_ADJUSTMENT,
  INITIATIVE_AGREEMENT
} from '@/views/Transactions/constants'

export const useTransactionMutation = (
  t,
  setAlertMessage,
  setAlertSeverity,
  setModalData,
  alertRef,
  queryClient
) => {
  const navigate = useNavigate()

  // Helper function to determine routes based on transaction type and ID
  const getTransactionRoutes = (transactionType, id) => {
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
        id
      ),
      viewRoute: typeRoutes[transactionType].viewRoute.replace(
        ':transactionId',
        id
      )
    }
  }

  const handleSuccess = (response, transactionId, transactionType) => {
    setModalData(null)
    const status = response.data.currentStatus.status
    const idField =
      transactionType === ADMIN_ADJUSTMENT
        ? 'adminAdjustmentId'
        : 'initiativeAgreementId'
    const idPrefix =
      transactionType === ADMIN_ADJUSTMENT
        ? 'adminadjustment-'
        : 'initiativeagreement-'
    const txnId = response.data[idField]
    const { editRoute, viewRoute } = getTransactionRoutes(
      transactionType,
      txnId
    )

    // Check if returned flag is true
    const isReturned = response.data.returned

    // Invalidate relevant queries
    queryClient.invalidateQueries([transactionType, transactionId])

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
      alertRef.current.triggerAlert()
    }
    window.scrollTo(0, 0)
  }

  const handleError = (_error, transactionId, transactionType) => {
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
    alertRef.current.triggerAlert()
    window.scrollTo(0, 0)
  }

  return { handleSuccess, handleError }
}
