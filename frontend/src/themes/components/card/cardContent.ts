import type { Components, Theme } from '@mui/material/styles'
import { pxToRem } from '@/themes/utils'

const cardContent: NonNullable<Components<Theme>['MuiCardContent']> = {
  styleOverrides: {
    root: {
      marginTop: 0,
      marginBottom: 0,
      padding: `${pxToRem(8)} ${pxToRem(24)} ${pxToRem(24)}`
    }
  }
}

export default cardContent
