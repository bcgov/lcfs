import type { Components, Theme } from '@mui/material/styles'
import { pxToRem } from '../utils'

const svgIcon: NonNullable<Components<Theme>['MuiSvgIcon']> = {
  defaultProps: {
    fontSize: 'inherit'
  },

  styleOverrides: {
    fontSizeInherit: {
      fontSize: 'inherit !important'
    },

    fontSizeSmall: {
      fontSize: `${pxToRem(20)} !important`
    },

    fontSizeLarge: {
      fontSize: `${pxToRem(36)} !important`
    }
  }
}

export default svgIcon
