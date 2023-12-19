import borders from '@/themes/base/borders'
import boxShadows from '@/themes/base/boxShadows'

const { borderRadius } = borders
const { xxl } = boxShadows

const dialog = {
  styleOverrides: {
    paper: {
      borderRadius: borderRadius.lg,
      boxShadow: xxl
    },

    paperFullScreen: {
      borderRadius: 0
    }
  }
}

export default dialog
