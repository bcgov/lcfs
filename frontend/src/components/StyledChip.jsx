import colors from '@/themes/base/colors'
import { Chip, styled } from '@mui/material'

export const StyledChip = styled(Chip)({
  fontWeight: 'bold',
  height: '26px',
  margin: '6px 8px 6px 4px',
  fontSize: '16px',
  borderRadius: '8px',
  backgroundColor: colors.nav.main
})
