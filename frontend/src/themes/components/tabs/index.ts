import type { Components, CSSObject, Theme } from '@mui/material/styles'
import colors from '@/themes/base/colors'
import borders from '@/themes/base/borders'
import boxShadows from '@/themes/base/boxShadows'

import { pxToRem } from '@/themes/utils'

const { grey, white } = colors
const { borderRadius } = borders
const { tabsBoxShadow } = boxShadows

const tabs: NonNullable<Components<Theme>['MuiTabs']> = {
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
      overflow: 'unset !important' as CSSObject['overflow'],
      overflowX: 'unset !important' as CSSObject['overflowX']
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
