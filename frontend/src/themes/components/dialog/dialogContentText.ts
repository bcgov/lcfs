import type { Components, Theme } from '@mui/material/styles'
import typography from '@/themes/base/typography'
import colors from '@/themes/base/colors'

const { size } = typography
const { text } = colors

const dialogContentText: NonNullable<
  Components<Theme>['MuiDialogContentText']
> = {
  styleOverrides: {
    root: {
      fontSize: size.md,
      color: text.main
    }
  }
}

export default dialogContentText
