import borders from '@/themes/base/borders'
import colors from '@/themes/base/colors'

import { pxToRem, linearGradient } from '@/themes/utils'

const { borderWidth, borderColor } = borders
const { transparent, primary, background } = colors

const handleToggleOnEnter = (event) => {
  if (event.key !== 'Enter' || event.defaultPrevented) return

  event.preventDefault()
  event.currentTarget.click()
}

const checkbox = {
  defaultProps: {
    onKeyDown: handleToggleOnEnter
  },
  styleOverrides: {
    root: {
      padding: 0,
      marginTop: 3,
      '& .MuiSvgIcon-root': {
        backgroundPosition: 'center',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        width: pxToRem(20),
        height: pxToRem(20),
        color: transparent.main,
        border: `${borderWidth[1]} solid ${colors.grey[700]}`,
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
      color: colors.grey[700],

      '&.Mui-checked': {
        color: colors.grey[700],

        '& .MuiSvgIcon-root': {
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -1 22 22'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' d='M6 10l3 3l6-6'/%3e%3c/svg%3e"), ${linearGradient(
            primary.main,
            primary.main
          )}`,
          borderColor: primary.main
        },
        '&.Mui-disabled .MuiSvgIcon-fontSizeMedium': {
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -1 22 22'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' d='M6 10l3 3l6-6'/%3e%3c/svg%3e"), ${linearGradient(
            colors.grey[500],
            colors.grey[500]
          )}`,
          borderColor: colors.grey[500]
        }
      }
    },

    colorSecondary: {
      color: colors.grey[700],

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
