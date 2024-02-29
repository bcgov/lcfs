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

export const saveDraftButton = (saveDraftlabel) => {
  return {
    ...outlineBase,
    label: saveDraftlabel,
    startIcon: faFloppyDisk
  }
}
export const submitButton = (submitLabel) => {
  return {
    ...containedBase,
    label: submitLabel,
    startIcon: faPencil
  }
}

export const deleteDraftButton = (deleteDraftLabel) => {
  return {
    ...redBase,
    label: deleteDraftLabel,
    startIcon: faTrash
  }
}
