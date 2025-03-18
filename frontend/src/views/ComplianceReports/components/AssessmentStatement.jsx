import { FloatingAlert } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import {
  useGetComplianceReport,
  useUpdateComplianceReport
} from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { InputBase } from '@mui/material'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { roles } from '@/constants/roles.js'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'

export const AssessmentStatement = () => {
  const ref = useRef(null)
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
  const [assessmentStatement, setAssessmentStatement] = useState(
    reportData?.report.assessmentStatement
  )

  const { mutate: saveAssessmentStatement } =
    useUpdateComplianceReport(complianceReportId)

  const currentStatus = reportData?.report.currentStatus?.status

  const canEdit = useMemo(() => {
    const roleStatusMap = {
      [roles.analyst]: [
        COMPLIANCE_REPORT_STATUSES.SUBMITTED,
        COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
      ],
      [roles.compliance_manager]: [
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
      ],
      [roles.director]: [COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER]
    }

    return Object.entries(roleStatusMap).some(
      ([role, statuses]) => hasRoles(role) && statuses.includes(currentStatus)
    )
  }, [currentStatus, hasRoles])

  const handleSaveAssessmentStatement = () =>
    saveAssessmentStatement(
      {
        assessmentStatement,
        status: reportData?.report.currentStatus?.status
      },
      {
        onSuccess: () =>
          ref.current?.triggerAlert({
            message: t('report:assessmentStatementSaveSuccess'),
            severity: 'success'
          }),
        onError: () =>
          ref.current?.triggerAlert({
            message: t('report:assessmentStatementSaveError'),
            severity: 'error'
          })
      }
    )

  if (isReportLoading || isCurrentUserLoading) {
    return <Loading />
  }

  return (
    <>
      <FloatingAlert ref={ref} data-test="alert-box" delay={10000} />
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
              disabled={!canEdit}
              multiline
              rows={4}
              sx={{
                textarea: { resize: 'both' },
                width: '100%',
                fontSize: '16px'
              }}
              value={assessmentStatement}
              onChange={(e) => setAssessmentStatement(e.target.value)}
            />
          </BCBox>
          <BCButton
            variant="outlined"
            color="primary"
            disabled={!canEdit}
            onClick={handleSaveAssessmentStatement}
          >
            {t('report:saveStatement')}
          </BCButton>
        </BCBox>
      </BCBox>
    </>
  )
}
