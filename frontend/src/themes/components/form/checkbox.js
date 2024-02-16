import borders from '@/themes/base/borders'
import colors from '@/themes/base/colors'

import { pxToRem, linearGradient } from '@/themes/utils'

const { borderWidth, borderColor } = borders
const { transparent, primary, background, white } = colors

const checkbox = {
  styleOverrides: {
    root: {
      padding: 0,
      '& .MuiSvgIcon-root': {
        backgroundPosition: 'center',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        width: pxToRem(20),
        height: pxToRem(20),
        color: transparent.main,
        border: `${borderWidth[1]} solid ${borderColor}`,
        borderRadius: pxToRem(5.6),
        backgroundColor: background.default
      },

      '&:hover': {
        backgroundColor: transparent.main
      },

      '&.Mui-focusVisible': {
        border: `${borderWidth[2]} solid ${primary.main} !important`
      },
      '& .MuiSvgIcon-fontSizeMedium': {
        borderColor: colors.grey[700]
      },
      '&.Mui-disabled .MuiSvgIcon-fontSizeMedium': {
        borderColor: colors.grey[500],
        backgroundColor: colors.grey[100]
      }
    },

    colorPrimary: {
      color: borderColor,

      '&.Mui-checked': {
        color: colors.grey[700],

        '& .MuiSvgIcon-root': {
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -1 22 22'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' d='M6 10l3 3l6-6'/%3e%3c/svg%3e"), ${linearGradient(
            colors.grey[700],
            colors.grey[700]
          )}`,
          borderColor: primary.main
        }
      }
    },

    colorSecondary: {
      color: borderColor,

      '& .MuiSvgIcon-root': {
        color: primary.main,
        '&.Mui-checked': {
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -1 22 22'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' d='M6 10l3 3l6-6'/%3e%3c/svg%3e"), ${linearGradient(
            primary.main,
            primary.main
          )}`,
          borderColor: primary.main
        }
      }
    }
  }
}

export default checkbox
