import colors from '@/themes/base/colors'
import {
  faFloppyDisk,
  faPencil,
  faTrash
} from '@fortawesome/free-solid-svg-icons'

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

export const saveDraftButton = (label) => ({
  ...outlineBase,
  label,
  startIcon: faFloppyDisk
})
export const submitButton = (label) => ({
  ...containedBase,
  label,
  startIcon: faPencil
})

export const deleteDraftButton = (label) => ({
  ...redBase,
  label,
  startIcon: faTrash
})

export const rescindButton = (label) => ({
  ...redBase,
  label,
  startIcon: faTrash
})
