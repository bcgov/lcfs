import colors from '@/themes/base/colors'
import boxShadows from '@/themes/base/boxShadows'
import borders from '@/themes/base/borders'

const { white } = colors
const { md } = boxShadows
const { borderRadius } = borders

const tableContainer = {
  styleOverrides: {
    root: {
      backgroundColor: white.main,
      boxShadow: md,
      borderRadius: borderRadius.xl
    }
  }
}

export default tableContainer
