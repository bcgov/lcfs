import colors from '@/themes/base/colors'
import borders from '@/themes/base/borders'
import typography from '@/themes/base/typography'

import { pxToRem } from '@/themes/utils'

const { light, text, dark } = colors
const { borderRadius } = borders
const { size } = typography

const menuItem = {
  styleOverrides: {
    root: {
      minWidth: pxToRem(160),
      minHeight: 'unset',
      padding: `${pxToRem(4.8)} ${pxToRem(16)}`,
      borderRadius: borderRadius.md,
      fontSize: size.sm,
      color: text.main,
      transition: 'background-color 300ms ease, color 300ms ease',

      '&:hover, &:focus, &.Mui-selected, &.Mui-selected:hover, &.Mui-selected:focus':
        {
          backgroundColor: light.main,
          color: dark.main
        }
    }
  }
}

export default menuItem
