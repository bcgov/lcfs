import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { ChargingSiteCard } from './components/ChargingSiteCard'
import { ChargingSiteDocument } from './components/ChargingSiteDocument'
import { ChargingSiteFSEGrid } from './components/ChargingSiteFSEGrid'
import { useGetChargingSiteById } from '@/hooks/useChargingSite'
import { useParams } from 'react-router-dom'
import { BCAlert2 } from '@/components/BCAlert'
import { useRef } from 'react'
import Loading from '@/components/Loading'
import ChargingSitesMap from './components/ChargingSitesMap'
import BCBox from '@/components/BCBox'
import { Grid2 } from '@mui/material'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { govRoles } from '@/constants/roles'

export const ViewChargingSite = () => {
  const { t } = useTranslation('chargingSite')
  const alertRef = useRef(null)
  const { siteId } = useParams()
  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles,
    hasAnyRole
  } = useCurrentUser()
  const {
    data: chargingSiteData,
    isLoading,
    isError,
    refetch
  } = useGetChargingSiteById(siteId)

  if (isLoading || isCurrentUserLoading) {
    return <Loading />
  }
  const orgID = currentUser?.organization?.organizationId
  const isIDIR = hasAnyRole(...govRoles)
  if (isError) {
    alertRef.current?.triggerAlert({
      message: t('error'),
      severity: 'error'
    })
  }

  return isError ? (
    <BCAlert2 severity="error" message={t('error')} ref={alertRef} />
  ) : (
    <div data-test="view-charging-site-fse">
      <BCTypography variant="h5" color="primary">
        {isIDIR ? t('idirSitetitle') : t('viewTitle')}
      </BCTypography>
      <ChargingSiteCard
        data={chargingSiteData}
        hasAnyRole={hasAnyRole}
        hasRoles={hasRoles}
        isIDIR={isIDIR}
        refetch={refetch}
      />
      <ChargingSiteDocument attachments={chargingSiteData?.documents} />
      <ChargingSiteFSEGrid
        hasAnyRole={hasAnyRole}
        hasRoles={hasRoles}
        isIDIR={isIDIR}
        currentUser={currentUser}
      />
    </div>
  )
}
