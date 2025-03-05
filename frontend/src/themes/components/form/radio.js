import borders from '@/themes/base/borders'

import { pxToRem } from '@/themes/utils'
const { borderWidth, borderColor } = borders

const radio = {
  styleOverrides: {
    root: {
      padding: 0,
      marginTop: 3,
      '& .MuiSvgIcon-root': {
        width: pxToRem(20),
        height: pxToRem(20),
        border: `${borderWidth[1]} solid ${borderColor}`,
        borderRadius: '50%'
      }
    }
  }
}

export default radio
