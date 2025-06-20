import { FloatingAlert } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { useUpdateComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { InputBase } from '@mui/material'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { roles } from '@/constants/roles.js'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import useComplianceReportStore from '@/stores/useComplianceReportStore'

export const AssessmentStatement = ({ methods }) => {
  const ref = useRef(null)
  const { t } = useTranslation(['common', 'report'])
  const { complianceReportId } = useParams()
  const { hasRoles } = useCurrentUser()
  const { currentReport } = useComplianceReportStore()

  const { mutate: saveAssessmentStatement } =
    useUpdateComplianceReport(complianceReportId)

  const currentStatus = currentReport?.report.currentStatus?.status

  const canEdit = useMemo(() => {
    const roleStatusMap = {
      [roles.analyst]: [
        COMPLIANCE_REPORT_STATUSES.SUBMITTED,
        COMPLIANCE_REPORT_STATUSES.ANALYST_ADJUSTMENT
      ],
      [roles.compliance_manager]: [
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST
      ],
      [roles.director]: [
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_ANALYST,
        COMPLIANCE_REPORT_STATUSES.RECOMMENDED_BY_MANAGER
      ]
    }

    return Object.entries(roleStatusMap).some(
      ([role, statuses]) => hasRoles(role) && statuses.includes(currentStatus)
    )
  }, [currentStatus, hasRoles])

  const handleSaveAssessmentStatement = () => {
    const assessmentStatement = methods.getValues('assessmentStatement')
    saveAssessmentStatement(
      {
        assessmentStatement,
        status: currentReport?.report.currentStatus?.status
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
  }

  return (
    <>
      <FloatingAlert ref={ref} data-test="alert-box" delay={10000} />
      <BCBox>
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
              {...methods.register('assessmentStatement')}
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
