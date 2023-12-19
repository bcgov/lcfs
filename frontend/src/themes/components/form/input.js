import colors from '@/themes/base/colors'
import typography from '@/themes/base/typography'
import borders from '@/themes/base/borders'

const { info, inputBorderColor, dark } = colors
const { size } = typography
const { borderWidth } = borders

const input = {
  styleOverrides: {
    root: {
      fontSize: size.sm,
      color: dark.main,

      '&:hover:not(.Mui-disabled):before': {
        borderBottom: `${borderWidth[1]} solid ${inputBorderColor}`
      },

      '&:before': {
        borderColor: inputBorderColor
      },

      '&:after': {
        borderColor: info.main
      }
    }
  }
}

export default input
