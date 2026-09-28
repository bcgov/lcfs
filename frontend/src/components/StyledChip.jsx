import colors from '@/themes/base/colors'
import Chip from '@mui/material/Chip'
import { styled } from '@mui/material/styles'

export const StyledChip = styled(Chip)({
  fontWeight: 'bold',
  height: '26px',
  margin: '6px 8px 6px 4px',
  fontSize: '16px',
  borderRadius: '8px',
  backgroundColor: colors.nav.main
})
