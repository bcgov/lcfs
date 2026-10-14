import type { ICellRendererParams } from 'ag-grid-community'
import BCBadge from '@/components/BCBadge'
import BCBox from '@/components/BCBox'
import { CommonArrayRenderer } from '@/utils/grid/cellRenderers'
import { getAllFuelCodeStatuses } from '@/constants/statuses'
import { formatTransportModeDistances } from './fuelCodeGridUtils'

type FuelCodeStatusRow = { status?: string }
type TransportModeRendererParams = ICellRendererParams & {
  relationKey?: string
  disableLink?: boolean
}

export const FuelCodeStatusBadge = (
  props: ICellRendererParams<FuelCodeStatusRow>
) => {
  const statusArr = getAllFuelCodeStatuses()
  const statusIndex = statusArr.indexOf(props.data?.status)
  const statusColors = ['info', 'info', 'success', 'error']

  return (
    <BCBox sx={{ width: '100%', height: '100%' }}>
      <BCBox mt={1} sx={{ display: 'flex', justifyContent: 'center' }}>
        <BCBadge
          badgeContent={statusArr[statusIndex]}
          color={statusColors[statusIndex] ?? 'info'}
          variant="contained"
          size="lg"
          sx={{
            '& .MuiBadge-badge': {
              minWidth: '120px',
              fontWeight: 'regular',
              textTransform: 'capitalize',
              fontSize: '0.875rem',
              padding: '0.4em 0.6em'
            }
          }}
        />
      </BCBox>
    </BCBox>
  )
}

export const TransportModeCellRenderer = (
  props: TransportModeRendererParams
) => (
  <CommonArrayRenderer
    {...props}
    value={formatTransportModeDistances(props.value, props.relationKey || '')}
    disableLink={props.disableLink}
  />
)
