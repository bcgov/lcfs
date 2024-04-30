/* eslint-disable react-hooks/rules-of-hooks */

import colors from '@/themes/base/colors'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import { faFloppyDisk, faTrash } from '@fortawesome/free-solid-svg-icons'

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
  transactionId,
  methods,
  t
}) => {
  const transactionButtons = {
    saveDraft: {
      ...outlinedButton(t('txn:actionBtns.saveDraftBtn'), faFloppyDisk),
      id: 'save-draft-btn',
      handler: (formData) => {
        console.debug('saveDraft')
      }
    },
    recommendTransaction: {
      ...containedButton(t('txn:actionBtns.recommendBtn')),
      id: 'recommend-btn',
      handler: (formData) => {
        console.debug('recommendTransaction')
      }
    }
  }

  const buttons = {
    New: [transactionButtons.saveDraft, transactionButtons.recommendTransaction]
  }

  return buttons
}
