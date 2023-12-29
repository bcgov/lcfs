import borders from '@/themes/base/borders'
import colors from '@/themes/base/colors'

import { pxToRem, linearGradient } from '@/themes/utils'
const { borderWidth, borderColor } = borders
const { transparent, primary } = colors

const radio = {
  styleOverrides: {
    root: {
      padding: 0,
      '& .MuiSvgIcon-root': {
        width: pxToRem(20),
        height: pxToRem(20),
        color: transparent.main,
        border: `${borderWidth[1]} solid ${borderColor}`,
        borderRadius: '50%'
      },

      '&:after': {
        transition: 'opacity 250ms ease-in-out',
        content: '""',
        position: 'absolute',
        width: pxToRem(14),
        height: pxToRem(14),
        borderRadius: '50%',
        backgroundImage: linearGradient(primary.main, primary.main),
        opacity: 0,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        margin: 'auto'
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
        borderColor: colors.grey[500]
      }
    },

    colorPrimary: {
      color: borderColor,

      '&.Mui-checked': {
        color: colors.grey[700],

        '& .MuiSvgIcon-root': {
          borderColor: colors.grey[700]
        },

        '&:after': {
          opacity: 1
        }
      }
    },

    colorSecondary: {
      color: borderColor,

      '&.Mui-checked': {
        color: colors.grey[700],

        '& .MuiSvgIcon-root': {
          borderColor: colors.grey[700]
        },

        '&:after': {
          opacity: 1
        }
      }
    }
  }
}

export default radio
