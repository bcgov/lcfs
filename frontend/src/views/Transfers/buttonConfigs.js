import colors from '@/themes/base/colors'

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
