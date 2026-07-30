import { OpenInNew } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { ROUTES } from '@/routes/routes'

export function ReleaseNotesAdmin() {
  const { t } = useTranslation(['admin'])
  const navigate = useNavigate()

  return (
    <BCBox>
      <BCTypography variant="h5" mb={1}>
        {t('releaseNotesAdmin.title')}
      </BCTypography>
      <BCTypography variant="body2" color="text.secondary" mb={1}>
        {t('releaseNotesAdmin.description')}
      </BCTypography>
      <BCTypography variant="body2" color="text.secondary" mb={3}>
        {t('releaseNotesAdmin.howTo')}
      </BCTypography>
      <BCButton
        variant="contained"
        color="primary"
        startIcon={<OpenInNew />}
        onClick={() => navigate(ROUTES.RELEASE_NOTES)}
      >
        {t('releaseNotesAdmin.viewButton')}
      </BCButton>
    </BCBox>
  )
}

export default ReleaseNotesAdmin
