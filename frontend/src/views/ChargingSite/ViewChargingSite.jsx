import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { ChargingSiteCard } from './components/ChargingSiteCard'
import { ChargingSiteDocument } from './components/ChargingSiteDocument'
import { ChargingSiteFSEGrid } from './components/ChargingSiteFSEGrid'

export const ViewChargingSite = () => {
  const { t } = useTranslation('chargingSite')
  return (
    <div data-test="view-charging-site-fse">
      <BCTypography variant="h5" color="primary">
        {t('viewTitle')}
      </BCTypography>
      <ChargingSiteCard />
      <ChargingSiteDocument />
      <ChargingSiteFSEGrid />
    </div>
  )
}
