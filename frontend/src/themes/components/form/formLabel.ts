import type { Components, Theme } from '@mui/material/styles'
import colors from '@/themes/base/colors'

const { text } = colors

const formLabel: NonNullable<Components<Theme>['MuiFormLabel']> = {
  styleOverrides: {
    root: {
      color: text.main
    }
  }
}

export default formLabel
