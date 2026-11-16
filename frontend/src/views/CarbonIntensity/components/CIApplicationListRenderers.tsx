import type { ReactElement, ReactNode } from 'react'
import BCBox from '@/components/BCBox'
import BCUserInitials from '@/components/BCUserInitials/BCUserInitials'
import { CIApplicationStatusRenderer } from '@/utils/grid/cellRenderers'
import { createStatusRenderer } from '@/utils/grid/createStatusRenderer'
import {
  CI_APPLICATION_CHANGES_REQUESTED_LABEL,
  getCIApplicationDisplayStatus,
  type CIApplicationDisplayStatusData
} from './ciApplicationDisplayStatus'

const ANALYST_CHIP_SX = {
  bgcolor: '#606060',
  color: 'common.white',
  borderRadius: '50%',
  width: 32,
  height: 32,
  minWidth: 32,
  '& .MuiChip-label': { padding: 0 },
  '&:hover': { bgcolor: '#505050' }
}

// Centered chip wrapper so analyst / last-comment pills sit visually
// centered in their grid cell regardless of the row's natural height.
const PillCell = ({ children }: { children: ReactNode }) => (
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
    {children}
  </BCBox>
)

export const LastCommentRenderer = ({
  data
}: {
  data?: { lastComment?: { fullName?: string; comment?: string } }
}) => {
  const last = data?.lastComment
  if (!last?.fullName) {
    return <BCBox component="div" sx={{ width: '100%', height: '100%' }} />
  }
  return (
    <PillCell>
      <BCUserInitials
        fullName={last.fullName}
        tooltipText={last.comment}
        maxLength={500}
        variant="filled"
        sx={ANALYST_CHIP_SX}
      />
    </PillCell>
  )
}

const CIApplicationChangesRequestedRenderer = createStatusRenderer(
  { [CI_APPLICATION_CHANGES_REQUESTED_LABEL]: 'warning' },
  { statusField: 'status.status' },
  CI_APPLICATION_CHANGES_REQUESTED_LABEL
)

type CIApplicationStatusDisplayRendererComponent = ((props: {
  data?: CIApplicationDisplayStatusData
}) => ReactElement) & {
  filterPillRenderer?: typeof CIApplicationStatusRenderer.filterPillRenderer
}

export const CIApplicationStatusDisplayRenderer: CIApplicationStatusDisplayRendererComponent =
  (props) => {
    const displayStatus = getCIApplicationDisplayStatus(props.data)

    if (displayStatus !== CI_APPLICATION_CHANGES_REQUESTED_LABEL) {
      return <CIApplicationStatusRenderer {...props} />
    }

    return <CIApplicationChangesRequestedRenderer {...props} />
  }

CIApplicationStatusDisplayRenderer.filterPillRenderer =
  CIApplicationStatusRenderer.filterPillRenderer
