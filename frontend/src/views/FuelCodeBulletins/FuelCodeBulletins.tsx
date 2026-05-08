import { nonGovRoles, roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ROUTES from '@/routes/routes'
import withRole from '@/utils/withRole'
import { MyFuelCodes } from '@/views/FuelCodes'
import { Stack } from '@mui/material'
import { useState } from 'react'
import { BulletinMenuBar } from './components/BulletinMenuBar'
import { CurrentFuelCodes } from './components/CurrentFuelCodes'
import { ArchivedFuelCodes } from './components/ArchivedFuelCodes'

export const FuelCodeBulletinsBase = () => {
  const [activeTab, setActiveTab] = useState<string>('current')
  const { hasRoles } = useCurrentUser()
  const isCiApplicant = hasRoles(roles.ci_applicant)

  const renderActiveTab = () => {
    if (activeTab === 'my' && isCiApplicant) {
      return <MyFuelCodes />
    }
    if (activeTab === 'archived') {
      return <ArchivedFuelCodes />
    }
    return <CurrentFuelCodes />
  }

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <BulletinMenuBar activeTab={activeTab} onTabChange={setActiveTab} />
      {renderActiveTab()}
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
