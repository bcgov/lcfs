import colors from '@/themes/base/colors'
import borders from '@/themes/base/borders'
import boxShadows from '@/themes/base/boxShadows'

import { pxToRem } from '@/themes/utils'

const { grey, white } = colors
const { borderRadius } = borders
const { tabsBoxShadow } = boxShadows

const tabs = {
  styleOverrides: {
    root: {
      position: 'relative',
      backgroundColor: grey[100],
      borderRadius: borderRadius.xl,
      minHeight: 'unset',
      padding: pxToRem(4)
    },

    flexContainer: {
      height: '100%',
      position: 'relative',
      zIndex: 10
    },

    fixed: {
      overflow: 'unset !important',
      overflowX: 'unset !important'
    },

    vertical: {
      '& .MuiTabs-indicator': {
        width: '100%'
      }
    },

    indicator: {
      height: '100%',
      borderRadius: borderRadius.lg,
      backgroundColor: white.main,
      boxShadow: tabsBoxShadow.indicator,
      transition: 'all 500ms ease'
    }
  }
}

export default tabs
