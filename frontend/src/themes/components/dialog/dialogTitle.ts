import type { Components, Theme } from '@mui/material/styles'
import typography from '@/themes/base/typography'
import { pxToRem } from '@/themes/utils'
import colors from '@/themes/base/colors'

const { background, white } = colors
const { size } = typography

const dialogTitle: NonNullable<Components<Theme>['MuiDialogTitle']> = {
  styleOverrides: {
    root: {
      padding: pxToRem(16),
      fontSize: size.xl,
      backgroundColor: background.primary,
      border: 'none',
      color: white.main
    }
  }
}

export default dialogTitle
