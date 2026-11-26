import type { Components, Theme } from '@mui/material/styles'
import borders from '@/themes/base/borders'
import boxShadows from '@/themes/base/boxShadows'

const { borderRadius } = borders
const { xxl } = boxShadows

const dialog: NonNullable<Components<Theme>['MuiDialog']> = {
  styleOverrides: {
    paper: {
      borderRadius: borderRadius.lg,
      border: 'none',
      boxShadow: xxl
    },

    paperFullScreen: {
      borderRadius: 0
    }
  }
}

export default dialog
