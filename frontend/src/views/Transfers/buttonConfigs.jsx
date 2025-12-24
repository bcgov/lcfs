/* eslint-disable react-hooks/rules-of-hooks */
import colors from '@/themes/base/colors'
// constants
import { roles } from '@/constants/roles'
// icons
import { TRANSFER_STATUSES } from '@/constants/statuses'
import { dateFormatter } from '@/utils/formatters'
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

export const buttonClusterConfigFn = ({
  toOrgData,
  hasRoles,
  hasAnyRole,
  currentUser,
  methods,
  t,
  setModalData,
  createUpdateTransfer,
  transferData,
  isGovernmentUser,
  recommendation,
  signingAuthorityDeclaration
}) => {
  const toOrganization = toOrgData?.find(
    (org) => org?.organizationId === methods.getValues('toOrganizationId')
  )
  const fromOrgId = methods.getValues('fromOrganizationId')
  const isDirector = hasRoles(roles.director)

  const transferButtons = {
    saveDraft: {
      ...outlinedButton(t('transfer:actionBtns.saveDraftBtn'), faFloppyDisk),
      id: 'save-draft-btn',
      handler: (formData) => {
        createUpdateTransfer({
          data: {
            ...formData,
            fromOrganizationId: parseInt(formData.fromOrganizationId),
            toOrganizationId: parseInt(formData.toOrganizationId),
            agreementDate: formData.agreementDate.toISOString().split('T')[0],
            currentStatus: TRANSFER_STATUSES.DRAFT
          }
        })
      }
    },
    deleteDraft: {
      ...redOutlinedButton(t('transfer:actionBtns.deleteDraftBtn'), faTrash),
      id: 'delete-draft-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            createUpdateTransfer({
              data: {
                ...formData,
                agreementDate: dateFormatter(formData.agreementDate),
                currentStatus: TRANSFER_STATUSES.DELETED
              }
            }),
          primaryButtonText: t('transfer:actionBtns.deleteDraftBtn'),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:deleteConfirmText')
        })
      }
    },
    signAndSend: {
      ...containedButton(t('transfer:actionBtns.signAndSendBtn'), faPencil),
      disabled:
        !hasRoles(roles.signing_authority) || !signingAuthorityDeclaration,
      id: 'sign-and-send-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            createUpdateTransfer({
              data: {
                ...formData,
                fromOrganizationId: parseInt(formData.fromOrganizationId),
                toOrganizationId: parseInt(formData.toOrganizationId),
                agreementDate: formData.agreementDate
                  .toISOString()
                  .split('T')[0],
                currentStatus: TRANSFER_STATUSES.SENT
              }
            }),
          primaryButtonText: t('transfer:actionBtns.signAndSendBtn'),
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: (
            <TransferSummary
              transferData={{
                ...transferData,
                fromOrganization: currentUser.organization,
                toOrganization
              }}
              formData={formData}
            />
          )
        })
      }
    },
    signAndSubmit: {
      ...containedButton(t('transfer:actionBtns.signAndSubmitBtn'), faPencil),
      disabled:
        !hasRoles(roles.signing_authority) || !signingAuthorityDeclaration,
      id: 'sign-and-submit-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            createUpdateTransfer({
              data: {
                ...formData,
                agreementDate: dateFormatter(formData.agreementDate),
                currentStatus: TRANSFER_STATUSES.SUBMITTED
              }
            }),
          primaryButtonText: t('transfer:actionBtns.signAndSubmitBtn'),
          primaryButtonColor: 'primary',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:submitConfirmText')
        })
      }
    },
    declineTransfer: {
      ...redOutlinedButton(
        t('transfer:actionBtns.declineTransferBtn'),
        faTrash
      ),
      id: 'decline-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            createUpdateTransfer({
              data: {
                ...formData,
                agreementDate: dateFormatter(formData.agreementDate),
                currentStatus: TRANSFER_STATUSES.DECLINED
              }
            }),
          primaryButtonText: t('transfer:actionBtns.declineTransferBtn'),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:declineConfirmText')
        })
      }
    },
    rescindTransfer: {
      ...redOutlinedButton(
        t('transfer:actionBtns.rescindTransferBtn'),
        faTrash
      ),
      id: 'rescind-btn',
      handler: (formData) => {
        setModalData({
          primaryButtonAction: () =>
            createUpdateTransfer({
              data: {
                ...formData,
                agreementDate: dateFormatter(formData.agreementDate),
                currentStatus: TRANSFER_STATUSES.RESCINDED
              }
            }),
          primaryButtonText: t('transfer:actionBtns.rescindTransferBtn'),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:rescindConfirmText')
        })
      }
    },
    saveComment: {
      ...outlinedButton(t('saveBtn'), faFloppyDisk),
      id: 'save-comment-btn',
      handler: (formData) =>
        createUpdateTransfer({
          data: {
            ...formData,
            agreementDate: dateFormatter(transferData.agreementDate),
            currentStatus: transferData.currentStatus.status
          }
        }),
      disabled: !isGovernmentUser
    },
    refuseTransfer: {
      ...redOutlinedButton(t('transfer:actionBtns.refuseTransferBtn')),
      id: 'refuse-btn',
      handler: (formData) =>
        setModalData({
          primaryButtonAction: () =>
            createUpdateTransfer({
              data: {
                ...formData,
                agreementDate: dateFormatter(transferData.agreementDate),
                currentStatus: TRANSFER_STATUSES.REFUSED
              }
            }),
          primaryButtonText: t('transfer:actionBtns.refuseTransferBtn'),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:refuseConfirmText'),
          warningText: t('transfer:refuseWarningText')
        }),
      disabled: !hasRoles(roles.director)
    },
    recordTransfer: {
      ...containedButton(t('transfer:actionBtns.recordTransferBtn')),
      id: 'record-btn',
      handler: (formData) =>
        setModalData({
          primaryButtonAction: () =>
            createUpdateTransfer({
              data: {
                ...formData,
                agreementDate: dateFormatter(transferData.agreementDate),
                currentStatus: TRANSFER_STATUSES.RECORDED
              }
            }),
          primaryButtonText: t('transfer:actionBtns.recordTransferBtn'),
          primaryButtonColor: 'primary',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:recordConfirmText')
        })
    },
    recommendTransfer: {
      ...containedButton(t('transfer:actionBtns.recommendBtn')),
      id: 'recommend-btn',
      disabled: !recommendation,
      tooltip: isDirector ? 'Acting as Analyst' : null,
      roleIndicator: isDirector ? 'Analyst' : null,
      handler: (formData) =>
        setModalData({
          primaryButtonAction: () =>
            createUpdateTransfer({
              data: {
                ...formData,
                agreementDate: dateFormatter(transferData.agreementDate),
                currentStatus: TRANSFER_STATUSES.RECOMMENDED
              }
            }),
          primaryButtonText: t('transfer:actionBtns.recommendBtn'),
          primaryButtonColor: 'primary',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:recommendConfirmText')
        })
    },
    returnToAnalyst: {
      ...outlinedButton(t('transfer:actionBtns.returnToAnalystBtn')),
      id: 'return-to-analyst-btn',
      handler: (formData) =>
        setModalData({
          primaryButtonAction: () =>
            createUpdateTransfer({
              data: {
                ...formData,
                agreementDate: dateFormatter(transferData.agreementDate),
                currentStatus: TRANSFER_STATUSES.SUBMITTED
              }
            }),
          primaryButtonText: t('transfer:actionBtns.returnToAnalystBtn'),
          primaryButtonColor: 'error',
          secondaryButtonText: t('cancelBtn'),
          title: t('confirmation'),
          content: t('transfer:returnConfirmText'),
          warningText: t('transfer:returnWarningText')
        }),
      disabled: !hasRoles(roles.director)
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
      ...(currentUser?.organization?.organizationId ===
        transferData?.toOrganization?.organizationId &&
      hasAnyRole(roles.transfers, roles.signing_authority)
        ? [transferButtons.declineTransfer, transferButtons.signAndSubmit]
        : []),
      ...(currentUser?.organization?.organizationId === fromOrgId &&
      hasRoles(roles.signing_authority)
        ? [transferButtons.rescindTransfer]
        : [])
    ],
    Rescinded: [],
    Declined: [],
    Submitted: [
      ...(currentUser?.isGovernmentUser && hasRoles(roles.analyst)
        ? [transferButtons.saveComment, transferButtons.recommendTransfer]
        : currentUser?.isGovernmentUser && hasRoles(roles.director)
          ? [transferButtons.saveComment, transferButtons.recommendTransfer]
          : [transferButtons.saveComment]),
      // Until the transfer is recorded, Org user has ability to rescind transfer
      ...((currentUser?.organization?.organizationId === fromOrgId ||
        currentUser?.organization?.organizationId ===
          transferData?.toOrganization?.organizationId) &&
      hasRoles(roles.signing_authority)
        ? [transferButtons.rescindTransfer]
        : [])
    ],
    Recommended: [
      ...(currentUser?.isGovernmentUser && hasRoles(roles.director)
        ? [
            transferButtons.refuseTransfer,
            transferButtons.saveComment,
            transferButtons.returnToAnalyst,
            transferButtons.recordTransfer
          ]
        : []),
      // Until the transfer is recorded, Org user has ability to rescind transfer
      ...((currentUser?.organization?.organizationId === fromOrgId ||
        currentUser?.organization?.organizationId ===
          transferData?.toOrganization?.organizationId) &&
      hasRoles(roles.signing_authority)
        ? [transferButtons.rescindTransfer]
        : [])
    ],
    Recorded: [],
    Refused: []
  }

  return buttons
}
