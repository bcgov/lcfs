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
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config.js'
import { Tooltip } from '@mui/material'

export const AssessmentRecommendation = ({
  reportData,
  currentStatus,
  complianceReportId
}) => {
  const { t } = useTranslation(['report', 'org'])
  const navigate = useNavigate()

  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false)
  const [isReassessmentDialogOpen, setIsReassessmentDialogOpen] =
    useState(false)

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

  const governmentAdjustmentDialog = (
    <>
      This will put the report into edit mode to update schedule information, do
      you want to proceed?
    </>
  )

  const reAssessmentDialog = (
    <>
      This will create a new version of the report for reassessment, do you want
      to proceed?
    </>
  )

  const onCreateAdjustment = () => {
    createAnalystAdjustment(complianceReportId)
  }

  const openReassessmentDialog = () => {
    setIsReassessmentDialogOpen(true)
  }

  const openAdjustmentDialog = () => {
    setIsAdjustmentDialogOpen(true)
  }

  return (
    <BCBox
      sx={{
        mt: 2,
        border: '1px solid rgba(0, 0, 0, 0.28)',
        padding: '20px'
      }}
    >
      {isFeatureEnabled(FEATURE_FLAGS.GOVERNMENT_ADJUSTMENT) &&
        currentStatus === COMPLIANCE_REPORT_STATUSES.SUBMITTED && (
          <BCTypography variant="body2">
            The analyst can make changes to the reported activity information if
            it is known to be incorrect, click to put the report in edit mode:
            <br />
            <Tooltip
              title={
                reportData.isNewest
                  ? ''
                  : 'Supplier has a supplemental report in progress.'
              }
              placement="right"
            >
              <span>
                <BCButton
                  onClick={openAdjustmentDialog}
                  sx={{ mt: 2 }}
                  color="primary"
                  variant="outlined"
                  disabled={!reportData.isNewest}
                >
                  Analyst adjustment
                </BCButton>
              </span>
            </Tooltip>
          </BCTypography>
        )}
      {isFeatureEnabled(FEATURE_FLAGS.GOVERNMENT_ADJUSTMENT) &&
        currentStatus === COMPLIANCE_REPORT_STATUSES.ASSESSED && (
          <Tooltip
            title={
              reportData.isNewest
                ? ''
                : 'Supplier has a supplemental report in progress.'
            }
            placement="right"
          >
            <span>
              <BCButton
                data-test="create-reassesment"
                variant="contained"
                color="primary"
                onClick={openReassessmentDialog}
                startIcon={
                  <Assignment
                    sx={{
                      width: '1rem',
                      height: '1rem'
                    }}
                  />
                }
                sx={{ mt: 2 }}
                disabled={isLoading || !reportData.isNewest}
              >
                {t('report:createReassessmentBtn')}
              </BCButton>
            </span>
          </Tooltip>
        )}
      <BCModal
        open={isReassessmentDialogOpen}
        onClose={() => setIsReassessmentDialogOpen(false)}
        data={{
          title: 'Create reassessment',
          primaryButtonText: 'Create',
          primaryButtonAction: onCreateAdjustment,
          secondaryButtonText: 'Cancel',
          content: reAssessmentDialog
        }}
      />
      <BCModal
        open={isAdjustmentDialogOpen}
        onClose={() => setIsAdjustmentDialogOpen(false)}
        data={{
          title: 'Create analyst adjustment',
          primaryButtonText: 'Create',
          primaryButtonAction: onCreateAdjustment,
          secondaryButtonText: 'Cancel',
          content: governmentAdjustmentDialog
        }}
      />
    </BCBox>
  )
}
