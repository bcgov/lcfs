import boxShadows from '@/themes/base/boxShadows'
import typography from '@/themes/base/typography'
import colors from '@/themes/base/colors'
import borders from '@/themes/base/borders'

import { pxToRem } from '@/themes/utils'

const { lg } = boxShadows
const { size } = typography
const { text, white, transparent, light, dark, gradients } = colors
const { borderRadius } = borders

const autocomplete = {
  styleOverrides: {
    popper: {
      boxShadow: lg,
      padding: pxToRem(0),
      fontSize: size.md,
      color: text.main,
      textAlign: 'left',
      backgroundColor: `${white.main} !important`,
      borderRadius: borderRadius.md
    },

    paper: {
      boxShadow: 'none',
      backgroundColor: transparent.main
    },

    option: {
      borderRadius: borderRadius.md,
      fontSize: size.md,
      color: text.main,
      lineHeight: 1.2,
      fontWeight: 300,
      transition: 'background-color 150ms ease, color 150ms ease',

      '&:hover, &:focus, &.Mui-selected, &.Mui-selected:hover, &.Mui-selected:focus':
        {
          backgroundColor: light.main,
          color: dark.main
        },

      '&[aria-selected="true"]': {
        backgroundColor: `${light.main} !important`,
        color: `${dark.main} !important`
      }
    },

    noOptions: {
      fontSize: size.md,
      color: text.main
    },

    groupLabel: {
      color: dark.main
    },

    loading: {
      fontSize: size.md,
      color: text.main
    },

    tag: {
      display: 'flex',
      alignItems: 'center',
      height: 'auto',
      padding: pxToRem(4),
      backgroundColor: gradients.dark.state,
      color: white.main,

      '& .MuiChip-label': {
        lineHeight: 1.2,
        padding: `0 ${pxToRem(10)} 0 ${pxToRem(4)}`
      },

      '& .MuiSvgIcon-root, & .MuiSvgIcon-root:hover, & .MuiSvgIcon-root:focus':
        {
          color: white.main,
          marginRight: 0
        }
    }
  }
}

export default autocomplete
