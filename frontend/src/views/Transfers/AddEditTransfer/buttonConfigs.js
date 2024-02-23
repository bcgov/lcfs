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

export const saveDraftButton = {
  ...outlineBase,
  label: 'Save Draft',
  startIcon: faFloppyDisk
}
export const submitButton = {
  ...containedBase,
  label: 'Sign and send',
  startIcon: faPencil
}

export const deleteDraftButton = {
  ...redBase,
  label: 'Delete Draft',
  startIcon: faTrash
}
