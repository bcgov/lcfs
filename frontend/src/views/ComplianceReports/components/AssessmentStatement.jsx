import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { InputBase } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

export const AssessmentStatement = () => {
  const { t } = useTranslation(['common', 'report'])
  const { complianceReportId } = useParams()

  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles
  } = useCurrentUser()
  const { data: reportData, isLoading: isReportLoading } =
    useGetComplianceReport(
      currentUser?.organization?.organizationId,
      complianceReportId
    )

  const currentStatus = reportData?.report.currentStatus?.status

  const disabled =
    (hasRoles('Analyst') && currentStatus !== 'Submitted') ||
    (hasRoles('Compliance Manager') &&
      currentStatus !== 'Recommended by analyst') ||
    (hasRoles('Director') && currentStatus !== 'Recommended by manager')

  if (isReportLoading || isCurrentUserLoading) {
    return <Loading />
  }

  return (
    <BCBox mt={4}>
      <BCTypography variant="h5" color="primary">
        {t(`report:assessmentRecommendation`)}
      </BCTypography>
      <BCTypography variant="h6" color="primary" mb={2}>
        {t(`report:directorStatement`)}
      </BCTypography>
      <BCBox variant="outlined" p={2}>
        <BCTypography variant="body2" mb={2}>
          {t(`report:assessmentStatementInstructions`)}
        </BCTypography>
        <BCBox variant="outlined" p={2} mb={2}>
          <InputBase
            disabled={disabled}
            multiline
            rows={4}
            sx={{
              textarea: { resize: 'both' },
              width: '100%',
              fontSize: '16px'
            }}
            value={reportData.report.assessmentStatement}
          />
        </BCBox>
        <BCButton variant="outlined" color="primary" disabled={disabled}>
          {t('report:saveStatement')}
        </BCButton>
      </BCBox>
    </BCBox>
  )
}
