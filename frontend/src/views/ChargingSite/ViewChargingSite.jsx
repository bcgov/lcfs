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
      <ChargingSiteCard data={chargingSiteData} />
      <ChargingSiteDocument attachments={chargingSiteData?.documents} />
      <ChargingSiteFSEGrid />
    </div>
  )
}
