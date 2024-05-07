// transactionMutations.js
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import { ADMIN_ADJUSTMENT, INITIATIVE_AGREEMENT } from './AddEditViewTransaction'

export const useTransactionMutation = (t, setAlertMessage, setAlertSeverity, setModalData, alertRef) => {
  const navigate = useNavigate()

  const handleSuccess = (response, transactionId, transactionType) => {
    setModalData(null)
    const status = response.data.currentStatus.status
    let editRoute

    // Determine the route based on transaction type
    if (transactionType === ADMIN_ADJUSTMENT) {
      editRoute = ROUTES.ADMIN_ADJUSTMENT_EDIT.replace(':transactionId', response.data.adminAdjustmentId)
    } else if (transactionType === INITIATIVE_AGREEMENT) {
      editRoute = ROUTES.INITIATIVE_AGREEMENT_EDIT.replace(':transactionId', response.data.initiativeAgreementId)
    }

    if (status === TRANSACTION_STATUSES.DRAFT) {
      navigate(editRoute, {
        state: {
          message: t(`${transactionType}:actionMsgs.${transactionId ? 'updatedText' : 'createdText'}`),
          severity: 'success'
        }
      })
    } else {
      setAlertMessage(t(`${transactionType}:actionMsgs.successText`, { status: 'saved' }))
      setAlertSeverity('success')
    }
    alertRef.current.triggerAlert()
  }

  const handleError = (_error, transactionId, transactionType) => {
    setModalData(null)
    const errorMsg = _error.response.data?.detail
    
    setAlertMessage(errorMsg || t(`${transactionType}:actionMsgs.error${transactionId ? 'Update' : 'Create'}Text`))
    setAlertSeverity('error')
    alertRef.current.triggerAlert()
    window.scrollTo(0, 0)
  }

  return { handleSuccess, handleError }
}
