import { useTranslation } from 'react-i18next'
import BCTypography from '@/components/BCTypography'

export const Notifications = () => {
  const { t } = useTranslation(['notifications'])

  return (
    <>
      <BCTypography variant="h5" color="primary" mb={2}>
        {t('title.Notifications')}
      </BCTypography>
    </>
  )
}
