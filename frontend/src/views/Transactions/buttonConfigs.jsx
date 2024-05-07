import colors from '@/themes/base/colors'
import { faFloppyDisk, faTrash } from '@fortawesome/free-solid-svg-icons'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import { ADMIN_ADJUSTMENT, INITIATIVE_AGREEMENT } from './AddEditViewTransaction'

const outlineBase = {
  variant: 'outlined',
  color: 'primary'
}

const containedBase = {
  variant: 'contained',
  color: 'primary',
  iconColor: colors.white.main
}

const redBase = {
  variant: 'outlined',
  color: 'error',
  iconColor: colors.error.main
}

const outlinedButton = (label, startIcon) => ({
  ...outlineBase,
  label,
  startIcon
})

const containedButton = (label, startIcon) => ({
  ...containedBase,
  label,
  startIcon
})

const redOutlinedButton = (label, startIcon) => ({
  ...redBase,
  label,
  startIcon
})

export const buttonClusterConfigFn = ({
  transactionId,
  transactionType,
  methods,
  t,
  setModalData,
  createUpdateAdminAdjustment,
  createUpdateInitiativeAgreement
}) => {
  const transactionButtons = {
    saveDraft: {
      ...outlinedButton(
        t(`txn:actionBtns.saveDraftBtn`),
        faFloppyDisk
      ),
      id: 'save-draft-btn',
      handler: (formData) => {
        const mutationFn = transactionType === ADMIN_ADJUSTMENT ? createUpdateAdminAdjustment : createUpdateInitiativeAgreement;
        mutationFn({
          data: {
            ...formData,
            currentStatus: TRANSACTION_STATUSES.DRAFT
          }
        })
      }
    },
    deleteDraft: {
      ...redOutlinedButton(
        t(`txn:actionBtns.deleteDraftBtn`),
        faTrash
      ),
      id: 'delete-draft-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () => {
            const mutationFn = transactionType === ADMIN_ADJUSTMENT ? createUpdateAdminAdjustment : createUpdateInitiativeAgreement;
            mutationFn({
              data: {
                ...formData,
                currentStatus: TRANSACTION_STATUSES.DELETED
              }
            })
          },
          primaryButtonText: t(`txn:actionBtns.deleteDraftBtn`),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t(`${transactionType}.deleteConfirmText`)
        })
      }
    },
    recommendTransaction: {
      ...containedButton(
        t(`txn:actionBtns.recommendBtn`),
      ),
      id: 'recommend-btn',
      handler: (formData) => {
        const mutationFn = transactionType === ADMIN_ADJUSTMENT ? createUpdateAdminAdjustment : createUpdateInitiativeAgreement;
        mutationFn({
          data: {
            ...formData,
            currentStatus: TRANSACTION_STATUSES.RECOMMENDED
          }
        })
      }
    },
    approveTransaction: {
      ...containedButton(
        t(`txn:actionBtns.approveBtn`),
      ),
      id: 'approve-btn',
      handler: (formData) => {
        const mutationFn = transactionType === ADMIN_ADJUSTMENT ? createUpdateAdminAdjustment : createUpdateInitiativeAgreement;
        mutationFn({
          data: {
            ...formData,
            currentStatus: TRANSACTION_STATUSES.APPROVED
          }
        })
      }
    },
    deleteTransaction: {
      ...redOutlinedButton(
        t(`txn:actionBtns.deleteBtn`),
        faTrash
      ),
      id: 'delete-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () => {
            const mutationFn = transactionType === ADMIN_ADJUSTMENT ? createUpdateAdminAdjustment : createUpdateInitiativeAgreement;
            mutationFn({
              data: {
                ...formData,
                currentStatus: TRANSACTION_STATUSES.DELETED
              }
            })
          },
          primaryButtonText: t(`txn:actionBtns.deleteBtn`),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t(`${transactionType}:deleteConfirmText`)
        })
      }
    }
  }

  const buttons = {
    New: [transactionButtons.saveDraft, transactionButtons.recommendTransaction],
    Draft: [transactionButtons.deleteDraft, transactionButtons.saveDraft, transactionButtons.recommendTransaction],
    Recommended: [transactionButtons.deleteTransaction, transactionButtons.approveTransaction],
    Approved: [],
    Deleted: []
  }

  return buttons
}
