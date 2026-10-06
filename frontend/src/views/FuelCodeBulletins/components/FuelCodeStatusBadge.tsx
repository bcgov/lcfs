import BCBadge from '@/components/BCBadge'
import type { BCBadgeColor } from '@/components/BCBadge/BCBadgeRoot'
import BCBox from '@/components/BCBox'
import { getAllFuelCodeStatuses } from '@/constants/statuses'
import type { FuelCodeCellParams } from '../_schema'

export const FuelCodeStatusBadge = (params: FuelCodeCellParams) => {
  const statusArr = getAllFuelCodeStatuses()
  const statusIndex = statusArr.indexOf(params.data?.status)
  const statusColors: BCBadgeColor[] = ['info', 'info', 'success', 'error']

  return (
    <BCBox sx={{ width: '100%', height: '100%' }}>
      <BCBox mt={1} sx={{ display: 'flex', justifyContent: 'center' }}>
        <BCBadge
          badgeContent={statusArr[statusIndex] ?? params.data?.status}
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

