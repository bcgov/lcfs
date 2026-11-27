import colors from '@/themes/base/colors'
// constants
import { roles } from '@/constants/roles'
// icons
import { TRANSFER_STATUSES } from '@/constants/statuses'
import { formatCalendarDate } from '@/utils/calendarDate'
import {
  faFloppyDisk,
  faPencil,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
import { TransferSummary } from './components/TransferSummary'
import type { ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type {
  AddEditTransferFormData,
  AddEditTransferFormState
} from './_schema'

export interface TransferOrganization {
  organizationId: number | string
  name: string
}

export interface TransferRecord {
  agreementDate?: Date | string | null
  currentStatus?: { status?: string }
  fromOrganization?: TransferOrganization
  toOrganization?: TransferOrganization
  quantity?: number
  pricePerUnit?: number
  recommendation?: string | null
  transferHistory?: Array<{
    transferStatus?: { status?: string }
    createDate: string
    displayName?: string
    userProfile?: {
      firstName?: string
      lastName?: string
      organization?: { name?: string }
    }
  }>
  comments?: Array<{
    commentSource?: string
    createDate: string
    comment?: string | null
    createdBy?: string | null
    createdByOrg?: string | null
  }>
}

interface TransferButtonConfig {
  variant: 'outlined' | 'contained'
  color: 'primary' | 'error'
  iconColor?: string
  label: string
  startIcon?: IconDefinition | string
  id?: string
  disabled?: boolean
  tooltip?: string | null
  roleIndicator?: string | null
  handler: (formData: AddEditTransferFormData) => void
}

export interface TransferModalData {
  primaryButtonAction: () => unknown
  primaryButtonText: string
  primaryButtonColor?: 'primary' | 'error'
  secondaryButtonText: string
  title: string
  content: ReactNode
  warningText?: string
}

interface ButtonClusterConfigParams {
  toOrgData?: TransferOrganization[]
  hasRoles: (...roleNames: string[]) => boolean
  hasAnyRole: (...roleNames: string[]) => boolean
  currentUser: {
    organization: TransferOrganization
    isGovernmentUser?: boolean
  }
  methods: Pick<UseFormReturn<AddEditTransferFormState>, 'getValues'>
  t: (key: string) => string
  setModalData: (data: TransferModalData) => void
  createUpdateTransfer: (input: { data: Record<string, unknown> }) => unknown
  transferData?: TransferRecord | null
  isGovernmentUser: boolean
  recommendation?: string | null
  signingAuthorityDeclaration?: boolean
}

const outlineBase: Pick<TransferButtonConfig, 'variant' | 'color'> = {
  variant: 'outlined',
  color: 'primary'
}

const containedBase: Pick<
  TransferButtonConfig,
  'variant' | 'color' | 'iconColor'
> = {
  variant: 'contained',
  color: 'primary',
  iconColor: colors.white.main
}

const redBase: Pick<TransferButtonConfig, 'variant' | 'color' | 'iconColor'> = {
  variant: 'outlined',
  color: 'error',
  iconColor: colors.error.main
}

export const redOutlinedButton = (
  label: string,
  startIcon?: IconDefinition | string
): Omit<TransferButtonConfig, 'handler'> => ({
  ...redBase,
  label,
  startIcon
})
export const outlinedButton = (
  label: string,
  startIcon?: IconDefinition | string
): Omit<TransferButtonConfig, 'handler'> => ({
  ...outlineBase,
  label,
  startIcon
})
export const containedButton = (
  label: string,
  startIcon?: IconDefinition | string
): Omit<TransferButtonConfig, 'handler'> => ({
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
}: ButtonClusterConfigParams): Record<string, TransferButtonConfig[]> => {
  const toOrganization = toOrgData?.find(
    (org) => org?.organizationId === methods.getValues('toOrganizationId')
  )
  const fromOrgId = methods.getValues('fromOrganizationId')
  const isDirector = hasRoles(roles.director)

  const transferButtons: Record<string, TransferButtonConfig> = {
    saveDraft: {
      ...outlinedButton(t('transfer:actionBtns.saveDraftBtn'), faFloppyDisk),
      id: 'save-draft-btn',
      handler: (formData) => {
        createUpdateTransfer({
          data: {
            ...formData,
            fromOrganizationId: parseInt(formData.fromOrganizationId),
            toOrganizationId: parseInt(formData.toOrganizationId),
            agreementDate: formatCalendarDate(formData.agreementDate),
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
                agreementDate: formatCalendarDate(formData.agreementDate),
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
                agreementDate: formatCalendarDate(formData.agreementDate),
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
                toOrganization: toOrganization!
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
                agreementDate: formatCalendarDate(formData.agreementDate),
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
                agreementDate: formatCalendarDate(formData.agreementDate),
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
                agreementDate: formatCalendarDate(formData.agreementDate),
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
            agreementDate: formatCalendarDate(transferData?.agreementDate),
            currentStatus: transferData?.currentStatus?.status
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
                agreementDate: formatCalendarDate(transferData?.agreementDate),
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
                agreementDate: formatCalendarDate(transferData?.agreementDate),
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
                agreementDate: formatCalendarDate(transferData?.agreementDate),
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
                agreementDate: formatCalendarDate(transferData?.agreementDate),
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
