import colors from '@/themes/base/colors'
import { pxToRem } from '@/themes/utils'

const { transparent } = colors

const select = {
  styleOverrides: {
    select: {
      display: 'flex',
      alignItems: 'center',
      padding: `0 ${pxToRem(10)} !important`,

      '& .Mui-selected': {
        backgroundColor: transparent.main
      }
    },

    selectMenu: {
      background: 'none',
      height: 'none',
      minHeight: 'none',
      overflow: 'unset'
    }
  }
}

export default select
