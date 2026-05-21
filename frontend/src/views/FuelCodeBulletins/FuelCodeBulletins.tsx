import { nonGovRoles } from '@/constants/roles'
import ROUTES from '@/routes/routes'
import withRole from '@/utils/withRole'
import { FuelCodesTabs } from '@/views/CarbonIntensity/components/FuelCodesTabs'
import { Stack } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { CurrentFuelCodes } from './components/CurrentFuelCodes'
import { ArchivedFuelCodes } from './components/ArchivedFuelCodes'

export const FuelCodeBulletinsBase = () => {
  const [searchParams] = useSearchParams()
  const isArchived = searchParams.get('type') === 'archived'

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <FuelCodesTabs />
      {isArchived ? <ArchivedFuelCodes /> : <CurrentFuelCodes />}
    </Stack>
  )
}

export const FuelCodeBulletins = withRole(
  FuelCodeBulletinsBase,
  nonGovRoles,
  ROUTES.DASHBOARD
)
FuelCodeBulletins.displayName = 'FuelCodeBulletins'

export default FuelCodeBulletins
