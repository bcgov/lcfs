import typography from '@/themes/base/typography'
import colors from '@/themes/base/colors'

import { pxToRem, rgba } from '@/themes/utils'

const { size, fontWeightRegular } = typography
const { white } = colors

const stepLabel = {
  styleOverrides: {
    label: {
      marginTop: `${pxToRem(8)} !important`,
      fontWeight: fontWeightRegular,
      fontSize: size.xs,
      color: '#9fc9ff',
      textTransform: 'uppercase',

      '&.Mui-active': {
        fontWeight: `${fontWeightRegular} !important`,
        color: `${rgba(white.main, 0.8)} !important`
      },

      '&.Mui-completed': {
        fontWeight: `${fontWeightRegular} !important`,
        color: `${rgba(white.main, 0.8)} !important`
      }
    }
  }
}

export default stepLabel
