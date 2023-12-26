import colors from '@/themes/base/colors'
import borders from '@/themes/base/borders'
import boxShadows from '@/themes/base/boxShadows'

import { pxToRem, linearGradient } from '@/themes/utils'

const { white, gradients, grey, transparent } = colors
const { borderWidth } = borders
const { md } = boxShadows

const switchButton = {
  defaultProps: {
    disableRipple: false
  },

  styleOverrides: {
    switchBase: {
      color: gradients.primary.main,

      '&:hover': {
        backgroundColor: transparent.main
      },

      '&.Mui-checked': {
        color: gradients.primary.main,

        '&:hover': {
          backgroundColor: transparent.main
        },

        '& .MuiSwitch-thumb': {
          borderColor: `${gradients.primary.main} !important`
        },

        '& + .MuiSwitch-track': {
          backgroundColor: `${gradients.primary.main} !important`,
          borderColor: `${gradients.primary.main} !important`,
          opacity: 1
        }
      },

      '&.Mui-disabled + .MuiSwitch-track': {
        opacity: '0.3 !important'
      },

      '&.Mui-focusVisible .MuiSwitch-thumb': {
        backgroundImage: linearGradient(
          gradients.info.main,
          gradients.info.state
        )
      }
    },

    thumb: {
      backgroundColor: white.main,
      boxShadow: md,
      border: `${borderWidth[1]} solid ${grey[400]}`
    },

    track: {
      width: pxToRem(32),
      height: pxToRem(15),
      backgroundColor: grey[400],
      border: `${borderWidth[1]} solid ${grey[400]}`,
      opacity: 1
    },

    checked: {}
  }
}

export default switchButton
