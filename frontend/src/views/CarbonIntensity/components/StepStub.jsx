import { Alert, Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import BCTypography from '@/components/BCTypography'

/**
 * Placeholder body for Steps 2-5 of the CI application wizard. Steps will
 * be implemented as separate stories by other developers; the stub keeps
 * the accordion frame, progress bar, and routing pattern in place so Step
 * 1 can ship independently.
 */
export const StepStub = ({ titleKey }) => {
  const { t } = useTranslation(['carbonIntensity'])
  return (
    <Box>
      <BCTypography variant="h6" sx={{ mb: 1 }}>
        {t(titleKey)}
      </BCTypography>
      <Alert severity="info" sx={{ mb: 2 }}>
        {t('carbonIntensity:stepStub.comingSoon')}
      </Alert>
      <BCTypography variant="body2" color="text.secondary">
        {t('carbonIntensity:stepStub.description')}
      </BCTypography>
    </Box>
  )
}

export default StepStub
