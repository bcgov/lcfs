import type { Components, Theme } from '@mui/material/styles'
import colors from '../base/colors'
import typography from '../base/typography'

const { grey } = colors
const { size } = typography

const breadcrumbs: NonNullable<Components<Theme>['MuiBreadcrumbs']> = {
  styleOverrides: {
    li: {
      lineHeight: 0
    },

    separator: {
      fontSize: size.sm,
      color: grey[600]
    }
  }
}

export default breadcrumbs
