import { nonGovRoles } from '@/constants/roles'
import ROUTES from '@/routes/routes'
import withRole from '@/utils/withRole'
import { Stack } from '@mui/material'
import { useState } from 'react'
import { BulletinMenuBar } from './components/BulletinMenuBar'
import { CurrentFuelCodes } from './components/CurrentFuelCodes'
import { ArchivedFuelCodes } from './components/ArchivedFuelCodes'

export const FuelCodeBulletinsBase = () => {
  const [activeTab, setActiveTab] = useState<string>('current')

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <BulletinMenuBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'current' ? (
        <CurrentFuelCodes />
      ) : (
        <ArchivedFuelCodes />
      )}
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
