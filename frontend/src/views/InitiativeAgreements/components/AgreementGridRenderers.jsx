import BCBox from '@/components/BCBox'
import BCUserInitials from '@/components/BCUserInitials/BCUserInitials'
import { createStatusRenderer } from '@/utils/grid/createStatusRenderer'

export const InitiativeAgreementStatusRenderer = createStatusRenderer(
  {
    Draft: 'info',
    Underway: 'success',
    Completed: 'primary',
    Terminated: 'warning'
  },
  { statusField: 'lifecycleStatus.status' }
)

const COMMENT_CHIP_SX = {
  bgcolor: '#606060',
  color: 'common.white',
  borderRadius: '50%',
  width: 32,
  height: 32,
  minWidth: 32,
  '& .MuiChip-label': { padding: 0 },
  '&:hover': { bgcolor: '#505050' }
}

export const LastCommentRenderer = ({ data }) => {
  const last = data?.lastComment
  if (!last?.fullName) {
    return <BCBox component="div" sx={{ width: '100%', height: '100%' }} />
  }
  return (
    <BCBox
      component="div"
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 1
      }}
    >
      <BCUserInitials
        fullName={last.fullName}
        tooltipText={last.comment}
        maxLength={500}
        variant="filled"
        sx={COMMENT_CHIP_SX}
      />
    </BCBox>
  )
}
