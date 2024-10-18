import typography from '@/themes/base/typography'
import borders from '@/themes/base/borders'
import colors from '@/themes/base/colors'

import { pxToRem } from '@/themes/utils'

const { size, fontWeightRegular } = typography
const { borderRadius } = borders
const { dark } = colors

const tab = {
  styleOverrides: {
    root: {
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'row',
      flex: '1 1 auto',
      textAlign: 'center',
      maxWidth: 'unset !important',
      minWidth: 'unset !important',
      minHeight: 'unset !important',
      fontSize: size.md,
      fontWeight: fontWeightRegular,
      textTransform: 'none',
      lineHeight: 'inherit',
      padding: pxToRem(4),
      borderRadius: borderRadius.lg,
      color: `${dark.main} !important`,
      opacity: '1 !important',

      '& .material-icons, .material-icons-round': {
        marginBottom: '0 !important',
        marginRight: pxToRem(6)
      },

      '& svg': {
        marginBottom: '0 !important',
        marginRight: pxToRem(6)
      }
    },

    labelIcon: {
      paddingTop: pxToRem(4)
    }
  }
}

export default tab
