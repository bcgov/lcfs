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

export const ViewChargingSite = () => {
  const { t } = useTranslation('chargingSite')
  const alertRef = useRef(null)
  const { chargingSiteId } = useParams()
  const {
    data: chargingSiteData,
    isLoading,
    isError
  } = useGetChargingSiteById(chargingSiteId)

  if (isLoading) {
    return <Loading />
  }
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
        {t('viewTitle')}
      </BCTypography>
      <BCBox sx={{ my: 3 }}>
        <Grid2 container spacing={1}>
          {/* Card Section - 7 parts (58.33%) */}
          <Grid2 size={{ xs: 12, md: 7 }}>
            <ChargingSiteCard data={chargingSiteData} />
          </Grid2>

          {/* Map Section - 3 parts (25%) */}
          <Grid2 size={{ xs: 12, md: 5 }}>
            <ChargingSitesMap
              sites={[chargingSiteData]}
              showLegend={false}
              height={225} // Adjust height as needed
            />
          </Grid2>
        </Grid2>
      </BCBox>
      <ChargingSiteDocument attachments={chargingSiteData?.documents} />
      <ChargingSiteFSEGrid />
    </div>
  )
}
