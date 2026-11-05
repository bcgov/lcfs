import type { Components, Theme } from '@mui/material/styles'
import colors from '@/themes/base/colors'

const { transparent } = colors

const textField: NonNullable<Components<Theme>['MuiTextField']> = {
  styleOverrides: {
    root: {
      backgroundColor: transparent.main
    }
  }
}

export default textField
