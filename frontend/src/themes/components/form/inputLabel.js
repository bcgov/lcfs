import colors from '@/themes/base/colors'
import typography from '@/themes/base/typography'

const { text, primary } = colors
const { size } = typography

const inputLabel = {
  styleOverrides: {
    root: {
      fontSize: size.md,
      color: text.main,
      lineHeight: 1.2,

      '&.Mui-focused': {
        color: primary.main,
        transform: 'translate(12px, -32px) scale(1)',
        lineHeight: '1.5'
      },

      '&.MuiInputLabel-shrink': {
        lineHeight: 1.5,
        fontWeight: 600,
        transform: 'translate(12px, -32px) scale(1)',

        '~ .MuiInputBase-root .MuiOutlinedInput-notchedOutline legend': {
          fontSize: '0.85em'
        }
      }
    },

    sizeSmall: {
      fontSize: size.xs,
      lineHeight: 1.625,

      '&.MuiInputLabel-shrink': {
        lineHeight: 1.6,
        fontSize: size.sm,

        '~ .MuiInputBase-root .MuiOutlinedInput-notchedOutline legend': {
          fontSize: '0.72em'
        }
      }
    }
  }
}

export default inputLabel
