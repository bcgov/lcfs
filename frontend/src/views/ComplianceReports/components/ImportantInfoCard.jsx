import { useTranslation } from 'react-i18next'
import { Stack, Typography } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCButton from '@/components/BCButton'
import AssignmentIcon from '@mui/icons-material/Assignment'
import InfoIcon from '@mui/icons-material/Info'

export const ImportantInfoCard = () => {
  const { t } = useTranslation(['report'])
  return (
    <BCWidgetCard
      component="div"
      style={{ height: 'fit-content', width: '30%' }}
      title={
        <>
          <Typography component="span" variant="body4">
            {t('report:impInfoTitle')}
          </Typography>{' '}
          <sub>
            <InfoIcon fontSize="small" />
          </sub>
        </>
      }
      content={
        <Stack direction="column" spacing={6}>
          <Typography component="div" variant="body4">
            {t('report:impInfo')}
          </Typography>
          <BCButton
            data-test="create-supplemental"
            size="large"
            variant="contained"
            color="primary"
            onClick={() => {
              console.log('create supplemental report button clicked')
            }}
            startIcon={<AssignmentIcon />}
            sx={{ mt: 2 }}
          >
            {t('report:createSupplementalRptBtn')}
          </BCButton>
        </Stack>
      }
    />
  )
}
