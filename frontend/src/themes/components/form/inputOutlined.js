import colors from '@/themes/base/colors'
import borders from '@/themes/base/borders'
import typography from '@/themes/base/typography'

import { pxToRem } from '@/themes/utils'

const { inputBorderColor, primary, error, grey, transparent, background } =
  colors
const { borderRadius } = borders
const { size } = typography

const inputOutlined = {
  styleOverrides: {
    root: {
      backgroundColor: transparent.main,
      fontSize: size.md,
      borderRadius: borderRadius.md,
      overflow: 'hidden',

      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: inputBorderColor
      },

      '&.Mui-focused': {
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: primary.main
        }
      },

      '&.Mui-error': {
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: error.main
        }
      }
    },

    notchedOutline: {
      borderColor: inputBorderColor
    },

    input: {
      color: grey[700],
      padding: pxToRem(12),
      backgroundColor: background.default
    },

    inputSizeSmall: {
      fontSize: size.sm,
      padding: pxToRem(10)
    },

    multiline: {
      color: grey[700],
      padding: 0
    }
  }
}

export default inputOutlined
