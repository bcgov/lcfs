import { useTranslation } from 'react-i18next'
import { Stack, Typography } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCButton from '@/components/BCButton'
import AssignmentIcon from '@mui/icons-material/Assignment'
import InfoIcon from '@mui/icons-material/Info'
import { useCreateSupplementalReport } from '@/hooks/useComplianceReports'
import { useNavigate } from 'react-router-dom'

export const ImportantInfoCard = ({ complianceReportId, alertRef }) => {
  const { t } = useTranslation(['report'])
  const navigate = useNavigate()

  const { mutate: createSupplementalReport, isLoading } =
    useCreateSupplementalReport(complianceReportId, {
      onSuccess: (data) => {
        // Navigate to the new report's page
        const newReportId = data.data.complianceReportId
        const compliancePeriodYear = data.data.compliancePeriod.description
        navigate(
          `/compliance-reporting/${compliancePeriodYear}/${newReportId}`,
          {
            state: {
              message: t('report:supplementalCreated'),
              severity: 'success'
            }
          }
        )
      },
      onError: (error) => {
        alertRef.current?.triggerAlert({
          message: error.message,
          severity: 'error'
        })
      }
    })

  return (
    <BCWidgetCard
      component="div"
      style={{ height: 'fit-content', maxWidth: '25%' }}
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
              createSupplementalReport()
            }}
            startIcon={<AssignmentIcon />}
            sx={{ mt: 2 }}
            disabled={isLoading}
          >
            {t('report:createSupplementalRptBtn')}
          </BCButton>
        </Stack>
      }
    />
  )
}
