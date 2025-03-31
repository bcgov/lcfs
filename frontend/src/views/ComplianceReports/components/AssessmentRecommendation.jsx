import React, { useState } from 'react'
import BCButton from '@/components/BCButton'
import { useCreateAnalystAdjustment } from '@/hooks/useComplianceReports'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import BCTypography from '@/components/BCTypography/index.jsx'
import BCBox from '@/components/BCBox/index.jsx'
import BCModal from '@/components/BCModal.jsx'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { Assignment } from '@mui/icons-material'

export const AssessmentRecommendation = ({
  currentStatus,
  complianceReportId
}) => {
  const { t } = useTranslation(['report', 'org'])
  const navigate = useNavigate()

  const [isOpen, setIsOpen] = useState(false)

  const { mutate: createAnalystAdjustment, isLoading } =
    useCreateAnalystAdjustment(complianceReportId, {
      onSuccess: (data) => {
        // Navigate to the new report's page
        const newReportId = data.data.complianceReportId
        const compliancePeriodYear = data.data.compliancePeriod.description
        navigate(
          `/compliance-reporting/${compliancePeriodYear}/${newReportId}`,
          {
            state: {
              message: t('report:analystAdjustmentCreated'),
              severity: 'success'
            }
          }
        )
      }
    })

  const dialogContent = (
    <>
      This will put the report into edit mode to update schedule information, do
      you want to proceed?
    </>
  )

  const onCreateAdjustment = () => {
    createAnalystAdjustment(complianceReportId)
  }

  const openDialog = () => {
    setIsOpen(true)
  }

  return (
    <BCBox sx={{ mt: 2 }}>
      {currentStatus === COMPLIANCE_REPORT_STATUSES.SUBMITTED && (
        <BCTypography variant="body2">
          The analyst can make changes to the reported activity information if
          it is known to be incorrect, click to put the report in edit mode:
          <br />
          <BCButton
            onClick={openDialog}
            sx={{ mt: 2 }}
            color="primary"
            variant="outlined"
          >
            Analyst adjustment
          </BCButton>
        </BCTypography>
      )}
      {currentStatus === COMPLIANCE_REPORT_STATUSES.ASSESSED && (
        <BCButton
          data-test="create-supplemental"
          size="small"
          className="svg-icon-button"
          variant="contained"
          color="primary"
          onClick={() => {
            alert('TODO')
          }}
          startIcon={<Assignment />}
          sx={{ mt: 2 }}
          disabled={isLoading}
        >
          {t('report:createReassessmentBtn')}
        </BCButton>
      )}
      <BCModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        data={{
          title: 'Create analyst adjustment',
          primaryButtonText: 'Create',
          primaryButtonAction: onCreateAdjustment,
          secondaryButtonText: 'Cancel',
          content: dialogContent
        }}
      />
    </BCBox>
  )
}
