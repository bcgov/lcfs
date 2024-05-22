import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import { ADMIN_ADJUSTMENT, INITIATIVE_AGREEMENT } from './AddEditViewTransaction'
import { TRANSACTIONS } from '@/constants/routes/routes'
import { useQueryClient } from '@tanstack/react-query'

export const useTransactionMutation = (t, setAlertMessage, setAlertSeverity, setModalData, alertRef, queryClient) => {
  const navigate = useNavigate()

  // Helper function to determine routes based on transaction type and ID
  const getTransactionRoutes = (transactionType, id) => {
    const typeRoutes = {
      [ADMIN_ADJUSTMENT]: {
        editRoute: ROUTES.ADMIN_ADJUSTMENT_EDIT,
        viewRoute: ROUTES.ADMIN_ADJUSTMENT_VIEW
      },
      [INITIATIVE_AGREEMENT]: {
        editRoute: ROUTES.INITIATIVE_AGREEMENT_EDIT,
        viewRoute: ROUTES.INITIATIVE_AGREEMENT_VIEW
      }
    }

    return {
      editRoute: typeRoutes[transactionType].editRoute.replace(':transactionId', id),
      viewRoute: typeRoutes[transactionType].viewRoute.replace(':transactionId', id)
    }
  }

  const handleSuccess = (response, transactionId, transactionType) => {
    setModalData(null)
    const status = response.data.currentStatus.status
    const idField = transactionType === ADMIN_ADJUSTMENT ? 'adminAdjustmentId' : 'initiativeAgreementId'
    const idPrefix = transactionType === ADMIN_ADJUSTMENT ? 'adminadjustment-' : 'initiativeagreement-'
    const txnId = response.data[idField]
    const { editRoute, viewRoute } = getTransactionRoutes(transactionType, txnId)
  
    // Check history for 'Recommended' status, to account for Returned action
    const hasRecommendedHistory = response.data.history?.some(item =>
      item.initiativeAgreementStatus?.status === 'Recommended' ||
      item.adminAdjustmentStatus?.status === 'Recommended'
    );
  
    // Invalidate relevant queries
    queryClient.invalidateQueries([transactionType, transactionId]);
  
    // Set the message and state for navigating
    const message = t(`${transactionType}:actionMsgs.${transactionId ? 'updatedText' : 'createdText'}`)
    const navigateState = {
      state: { message, severity: 'success' }
    }
  
    if (status === TRANSACTION_STATUSES.DRAFT && !hasRecommendedHistory) {
      navigate(editRoute, navigateState)
    } else if (status === TRANSACTION_STATUSES.DRAFT && hasRecommendedHistory) {
      navigate(TRANSACTIONS + `/?hid=${idPrefix}${txnId}`, {
        state: {
          message: t(`${transactionType}:actionMsgs.successText`, {
            status: response.data.currentStatus.status.toLowerCase()
          }),
          severity: 'success'
        }
      })
    } else if (status === TRANSACTION_STATUSES.RECOMMENDED ||
      status === TRANSACTION_STATUSES.APPROVED) {
      navigate(TRANSACTIONS + `/?hid=${idPrefix}${txnId}`, {
        state: {
          message: t(`${transactionType}:actionMsgs.successText`, {
            status: response.data.currentStatus.status.toLowerCase()
          }),
          severity: 'success'
        }
      })
    } else if (status === TRANSACTION_STATUSES.DELETED) {
      navigate(TRANSACTIONS, {})
    } else {
      setAlertMessage(t(`${transactionType}:actionMsgs.successText`, { status: 'saved' }))
      setAlertSeverity('success')
    }
    
    if (alertRef?.current) {
      alertRef.current.triggerAlert()
    }
    window.scrollTo(0, 0)
  }

  const handleError = (_error, transactionId, transactionType) => {
    setModalData(null)
    const errorMsg = _error.response?.data?.detail || t(`${transactionType}:actionMsgs.error${transactionId ? 'Update' : 'Create'}Text`)
    setAlertMessage(errorMsg)
    setAlertSeverity('error')
    alertRef.current.triggerAlert()
    window.scrollTo(0, 0)
  }

  return { handleSuccess, handleError }
}
