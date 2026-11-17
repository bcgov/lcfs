import type { Components, Theme } from '@mui/material/styles'
import { pxToRem } from '@/themes/utils'

const dialogActions: NonNullable<Components<Theme>['MuiDialogActions']> = {
  styleOverrides: {
    root: {
      padding: pxToRem(16)
    }
  }
}

export default dialogActions
