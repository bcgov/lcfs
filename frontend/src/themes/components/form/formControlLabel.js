import colors from '@/themes/base/colors'
import typography from '@/themes/base/typography'
import { pxToRem } from '@/themes/utils'

const { dark } = colors
const { size } = typography

const formControlLabel = {
  styleOverrides: {
    root: {
      display: 'flex',
      alignItems: 'start',
      gap: 8,
      minHeight: pxToRem(24),
      marginBottom: pxToRem(2),
      marginLeft: 0,
      marginRight: 0
    },

    label: {
      display: 'inline-block',
      fontSize: size.md,
      color: dark.main,
      lineHeight: '22px',
      transform: `translateY(${pxToRem(1)})`,
      marginLeft: pxToRem(4),

      '&.Mui-disabled': {
        color: dark.main
      }
    }
  }
}

export default formControlLabel
