import type { Components, Theme } from '@mui/material/styles'
import borders from '../base/borders'

const { borderRadius } = borders

const avatar: NonNullable<Components<Theme>['MuiAvatar']> = {
  styleOverrides: {
    root: {
      transition: 'all 200ms ease-in-out'
    },

    rounded: {
      borderRadius: borderRadius.lg
    },

    img: {
      height: 'auto'
    }
  }
}

export default avatar
