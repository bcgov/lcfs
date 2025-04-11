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
      },
      '&.Mui-disabled': {
        opacity: 0.8
      }
    },

    selectMenu: {
      background: 'none',
      height: 'none',
      minHeight: 'none',
      overflow: 'unset'
    },
    root: {
      '&.Mui-disabled': {
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: colors.grey[300]
        }
      },
      '&.Mui-disabled:hover': {
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: colors.grey[400]
        }
      }
    }
  }
}

export default select
