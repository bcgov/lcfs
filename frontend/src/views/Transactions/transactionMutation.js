// transactionMutations.js
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { TRANSACTION_STATUSES } from '@/constants/statuses';
import { ADMIN_ADJUSTMENT, INITIATIVE_AGREEMENT } from './AddEditViewTransaction';

export const useTransactionMutation = (t, setAlertMessage, setAlertSeverity, setModalData, alertRef) => {
  const navigate = useNavigate();

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
    };

    return {
      editRoute: typeRoutes[transactionType].editRoute.replace(':transactionId', id),
      viewRoute: typeRoutes[transactionType].viewRoute.replace(':transactionId', id)
    };
  };

  const handleSuccess = (response, transactionId, transactionType) => {
    setModalData(null);
    const status = response.data.currentStatus.status;
    const idField = transactionType === ADMIN_ADJUSTMENT ? 'adminAdjustmentId' : 'initiativeAgreementId'
    const { editRoute, viewRoute } = getTransactionRoutes(transactionType, response.data[idField]);

    // Set the message and state for navigating
    const message = t(`${transactionType}:actionMsgs.${transactionId ? 'updatedText' : 'createdText'}`);
    const navigateState = {
      state: { message, severity: 'success' }
    };

    if (status === TRANSACTION_STATUSES.DRAFT) {
      navigate(editRoute, navigateState);
    } else if (status === TRANSACTION_STATUSES.RECOMMENDED) {
      navigate(viewRoute, navigateState);
    } else {
      setAlertMessage(t(`${transactionType}:actionMsgs.successText`, { status: 'saved' }));
      setAlertSeverity('success');
      alertRef.current.triggerAlert();
    }

    alertRef.current.triggerAlert()
    window.scrollTo(0, 0);
  };

  const handleError = (_error, transactionId, transactionType) => {
    setModalData(null);
    const errorMsg = _error.response?.data?.detail || t(`${transactionType}:actionMsgs.error${transactionId ? 'Update' : 'Create'}Text`);
    
    setAlertMessage(errorMsg);
    setAlertSeverity('error');
    alertRef.current.triggerAlert();
    window.scrollTo(0, 0);
  };

  return { handleSuccess, handleError };
};
