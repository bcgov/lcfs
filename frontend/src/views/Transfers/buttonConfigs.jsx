import colors from '@/themes/base/colors'
// constants
import { roles } from '@/constants/roles'
// icons
import {
  faFloppyDisk,
  faPencil,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
import { TransferSummary } from './components'

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

export const redOutlinedButton = (label, startIcon) => ({
  ...redBase,
  label,
  startIcon
})
export const outlinedButton = (label, startIcon) => ({
  ...outlineBase,
  label,
  startIcon
})
export const containedButton = (label, startIcon) => ({
  ...containedBase,
  label,
  startIcon
})

export const stepsConfigFn = (isFetched, isGovernmentUser, transferStatus) => {
  if (isFetched) {
    if (isGovernmentUser && transferStatus !== 'Refused') {
      return ['Draft', 'Sent', 'Submitted', 'Recommended', 'Recorded']
    }
    switch (transferStatus) {
      case 'Rescinded':
        return ['Draft', 'Rescinded', 'Submitted', 'Recorded']
      case 'Declined':
        return ['Draft', 'Sent', 'Declined', 'Recorded']
      case 'Refused': {
        if (isGovernmentUser) {
          return ['Draft', 'Sent', 'Submitted', 'Recommended', 'Refused']
        }
        return ['Draft', 'Sent', 'Submitted', 'Refused']
      }
      case 'Deleted':
        return ['Draft', 'Deleted', 'Submitted', 'Recorded']
      default:
        return ['Draft', 'Sent', 'Submitted', 'Recorded']
    }
  }
  return ['Draft', 'Sent', 'Submitted', 'Recorded']
}

export const buttonClusterConfigFn = ({
  currentUserOrgId,
  toOrgId,
  hasAnyRole,
  t,
  setModalData,
  createDraft,
  updateDraft,
  updateTransfer,
  fromOrgId,
  hasRoles,
  signingAuthorityDeclaration,
  comment,
  transferData,
  isGovernmentUser
}) => {
  const transferButtons = {
    saveDraft: {
      ...outlinedButton(t('transfer:saveDraftBtn'), faFloppyDisk),
      handler: createDraft
    },
    updateDraft: {
      ...outlinedButton(t('transfer:saveDraftBtn'), faFloppyDisk),
      handler: updateDraft
    },
    deleteDraft: {
      ...redOutlinedButton(t('transfer:deleteDraftBtn'), faTrash),
      handler: (formData) =>
        setModalData({
          primaryButtonAction: () =>
            updateTransfer({
              comments: formData.comments,
              newStatus: 2,
              message: {
                success: t('transfer:deleteSuccessText'),
                error: t('transfer:deleteErrorText')
              }
            }),
          primaryButtonText: t('transfer:deleteDraftBtn'),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:deleteConfirmText')
        })
    },
    signAndSend: {
      ...containedButton(t('transfer:signAndSendBtn'), faPencil),
      disabled:
        !hasRoles(roles.signing_authority) || !signingAuthorityDeclaration,
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            updateTransfer({
              comments: formData.comments,
              newStatus: 3,
              message: {
                success: t('transfer:sendSuccessText'),
                error: t('transfer:sendErrorText')
              }
            }),
          primaryButtonText: t('transfer:signAndSendBtn'),
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: (
            <TransferSummary transferData={transferData} formData={formData} />
          )
        })
      }
    },
    signAndSubmit: {
      ...containedButton(t('transfer:signAndSubmitBtn'), faPencil),
      disabled:
        !hasRoles(roles.signing_authority) || !signingAuthorityDeclaration,
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            updateTransfer({
              // comments: formData.comments,
              newStatus: 4,
              message: {
                success: t('transfer:sendSuccessText'),
                error: t('transfer:sendErrorText')
              }
            }),
          primaryButtonText: t('transfer:signAndSubmitBtn'),
          primaryButtonColor: 'primary',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:submitConfirmText')
        })
      }
    },
    declineTransfer: {
      ...redOutlinedButton(t('transfer:declineTransferBtn'), faTrash),
      handler: (formData) =>
        setModalData({
          primaryButtonAction: () =>
            updateTransfer({
              newStatus: 8,
              message: {
                success: t('transfer:declineSuccessText'),
                error: t('transfer:declineErrorText')
              }
            }),
          primaryButtonText: t('transfer:declineTransferBtn'),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:declineConfirmText')
        })
    },
    rescindTransfer: {
      ...redOutlinedButton(t('transfer:rescindTransferBtn'), faTrash),
      handler: (formData) =>
        setModalData({
          primaryButtonAction: () =>
            updateTransfer({
              newStatus: 9,
              message: {
                success: t('transfer:rescindSuccessText'),
                error: t('transfer:rescindErrorText')
              }
            }),
          primaryButtonText: t('transfer:rescindTransferBtn'),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:rescindConfirmText')
        })
    },
    saveComment: {
      ...outlinedButton(t('saveBtn'), faFloppyDisk),
      handler: (formData) =>
        updateTransfer({
          comments: comment,
          newStatus: transferData?.currentStatus.transferStatusId,
          message: {
            success: t('transfer:commentSaveSuccessText'),
            error: t('transfer:commentSaveErrorText')
          }
        }),
      disabled: !isGovernmentUser
    },
    refuseTransfer: {
      ...redOutlinedButton(t('transfer:refuseTransferBtn')),
      handler: () =>
        setModalData({
          primaryButtonAction: () =>
            updateTransfer({
              newStatus: 4,
              message: {
                success: t('transfer:refuseSuccessText'),
                error: t('transfer:refuseErrorText')
              }
            }),
          primaryButtonText: t('transfer:refuseTransferBtn'),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:refuseConfirmText')
        }),
      disabled: !hasRoles(roles.director)
    },
    recordTransfer: {
      ...containedButton(t('transfer:recordTransferBtn')),
      handler: () =>
        setModalData({
          primaryButtonAction: () =>
            updateTransfer({
              comments: comment,
              newStatus: 6,
              message: {
                success: t('transfer:recordSuccessText'),
                error: t('transfer:recordErrorText')
              }
            }),
          primaryButtonText: t('transfer:recordTransferBtn'),
          primaryButtonColor: 'primary',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:recordConfirmText')
        })
    },
    recommendTransfer: {
      ...containedButton(t('transfer:recommendBtn')),
      handler: () =>
        setModalData({
          primaryButtonAction: () =>
            updateTransfer({
              comments: comment,
              newStatus: 6,
              message: {
                success: t('transfer:recommendSuccessText'),
                error: t('transfer:recommendErrorText')
              }
            }),
          primaryButtonText: t('transfer:recommendBtn'),
          primaryButtonColor: 'primary',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:recommendConfirmText')
        })
    }
  }

  const buttons = {
    New: [transferButtons.saveDraft, transferButtons.signAndSend],
    Draft: [
      transferButtons.deleteDraft,
      transferButtons.saveDraft,
      transferButtons.signAndSend
    ],
    Deleted: [],
    Sent: [
      ...(currentUserOrgId === toOrgId &&
      hasAnyRole(roles.transfers, roles.signing_authority)
        ? [transferButtons.declineTransfer, transferButtons.signAndSubmit]
        : []),
      ...(currentUserOrgId === fromOrgId && hasRoles(roles.signing_authority)
        ? [transferButtons.rescindTransfer]
        : [])
    ],
    Rescinded: [],
    Declined: [],
    Submitted: [
      ...(isGovernmentUser
        ? [transferButtons.saveComment, transferButtons.recommendTransfer]
        : []),
      // Until the transfer is recorded, Org user has ability to rescind transfer
      ...(currentUserOrgId === fromOrgId && hasRoles(roles.signing_authority)
        ? [transferButtons.rescindTransfer]
        : [])
    ],
    Recommended: [
      ...(isGovernmentUser
        ? [
            transferButtons.refuseTransfer,
            transferButtons.saveComment,
            transferButtons.recordTransfer
          ]
        : []),
      // Until the transfer is recorded, Org user has ability to rescind transfer
      ...(currentUserOrgId === fromOrgId && hasRoles(roles.signing_authority)
        ? [transferButtons.rescindTransfer]
        : [])
    ],
    Recorded: [],
    Refused: []
  }

  return buttons
}
