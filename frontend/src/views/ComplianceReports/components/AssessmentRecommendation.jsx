import React, { useState, useRef } from 'react'
import BCButton from '@/components/BCButton'
import {
  useCreateAnalystAdjustment,
  useUpdateComplianceReport
} from '@/hooks/useComplianceReports'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import BCTypography from '@/components/BCTypography/index.jsx'
import BCBox from '@/components/BCBox/index.jsx'
import BCModal from '@/components/BCModal.jsx'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { Assignment, CheckCircle } from '@mui/icons-material'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import { Tooltip, FormControlLabel, Checkbox, Fade } from '@mui/material'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useMemo } from 'react'

export const AssessmentRecommendation = ({
  reportData,
  currentStatus,
  complianceReportId,
  methods
}) => {
  const { t } = useTranslation(['report', 'org'])
  const navigate = useNavigate()
  const ref = useRef(null)
  const { hasRoles, data: currentUser } = useCurrentUser()

  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false)
  const [isReassessmentDialogOpen, setIsReassessmentDialogOpen] =
    useState(false)
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false)

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

  const { mutate: updateComplianceReport } = useUpdateComplianceReport(
    complianceReportId,
    {
      onSuccess: () => {
        // Show saved confirmation
        setShowSavedConfirmation(true)
        setTimeout(() => setShowSavedConfirmation(false), 3000)
      }
    }
  )

  const isGovernmentUser = currentUser?.isGovernmentUser
  const isAnalyst = hasRoles(roles.analyst)
  const isDirector = hasRoles(roles.director)

  // Determine if this is an original report (kept for backward compatibility)
  const isOriginalReport = useMemo(() => {
    return (
      reportData?.report?.version === 0 &&
      !reportData?.report?.supplementalInitiator &&
      reportData?.report?.reportingFrequency !== 'Quarterly'
    )
  }, [reportData])

  // Allow editing non-assessment checkbox when user is analyst or director and report is submitted
  const canEditNonAssessmentStatus = useMemo(() => {
    return (
      (isAnalyst || isDirector) &&
      currentStatus === COMPLIANCE_REPORT_STATUSES.SUBMITTED
    )
  }, [isAnalyst, isDirector, currentStatus])

  // Show non-assessment section for analysts and directors on all report types
  const shouldShowNonAssessmentSection = useMemo(() => {
    return (
      isGovernmentUser &&
      (isAnalyst || isDirector) &&
      currentStatus !== COMPLIANCE_REPORT_STATUSES.ASSESSED
    )
  }, [isGovernmentUser, isAnalyst, isDirector, currentStatus])
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

  const handleNonAssessmentChange = (event) => {
    const newValue = event.target.checked
    methods.setValue('isNonAssessment', newValue)

    // Automatically save the change
    updateComplianceReport({
      status: currentStatus,
      isNonAssessment: newValue
    })
  }

  // Don't show the component if Director on ASSESSED report (no content to display)
  const shouldShowReassessmentButton =
    isFeatureEnabled(FEATURE_FLAGS.GOVERNMENT_ADJUSTMENT) &&
    currentStatus === COMPLIANCE_REPORT_STATUSES.ASSESSED &&
    isAnalyst &&
    !isDirector

  // Directors should not see analyst adjustment button
  const shouldShowAnalystAdjustment =
    isFeatureEnabled(FEATURE_FLAGS.GOVERNMENT_ADJUSTMENT) &&
    currentStatus === COMPLIANCE_REPORT_STATUSES.SUBMITTED &&
    isAnalyst &&
    !isDirector

  const hasContentToShow = isDirector ? shouldShowNonAssessmentSection : true // Always show for non-Directors

  if (
    !hasContentToShow &&
    !shouldShowReassessmentButton &&
    !shouldShowAnalystAdjustment
  ) {
    return null
  }

  return (
    <BCBox
      sx={{
        mt: 2,
        border: '1px solid rgba(0, 0, 0, 0.28)',
        padding: '20px'
      }}
    >
      {isDirector && shouldShowNonAssessmentSection ? (
        <BCBox
          sx={{
            borderLeft: '3px solid',
            borderColor: 'primary.main',
            pl: 2,
            py: 0.5
          }}
        >
          <BCTypography
            variant="caption"
            sx={{
              color: 'primary.main',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.3px',
              mb: 2,
              display: 'block'
            }}
          >
            Acting as Analyst
          </BCTypography>

          {/* Not subject to assessment section - Only show for original reports */}
          {shouldShowNonAssessmentSection && (
            <BCBox
              mt={
                currentStatus === COMPLIANCE_REPORT_STATUSES.SUBMITTED ? 3 : 2
              }
            >
              <BCBox display="flex" alignItems="center" mb={2}>
                <BCTypography variant="h6" color="primary">
                  {t('report:notSubjectToAssessment')}
                </BCTypography>
                <Fade in={showSavedConfirmation}>
                  <BCBox display="flex" alignItems="center" ml={2}>
                    <CheckCircle
                      sx={{
                        color: 'success.main',
                        fontSize: '1rem',
                        mr: 0.5
                      }}
                    />
                    <BCTypography variant="body2" color="success.main">
                      Saved
                    </BCTypography>
                  </BCBox>
                </Fade>
              </BCBox>
              <FormControlLabel
                control={
                  <Checkbox
                    disabled={!canEditNonAssessmentStatus}
                    checked={methods.watch('isNonAssessment') || false}
                    onChange={handleNonAssessmentChange}
                  />
                }
                label={t('report:notSubjectToAssessmentDescription')}
                sx={{
                  alignItems: 'flex-start',
                  '& .MuiCheckbox-root': {
                    paddingTop: 0,
                    marginTop: '6px'
                  },
                  '& .MuiFormControlLabel-label': {
                    fontSize: '1rem',
                    lineHeight: 1.5
                  }
                }}
              />
            </BCBox>
          )}
        </BCBox>
      ) : (
        <>
          {/* Analyst adjustment section - Show above non-assessment */}
          {shouldShowAnalystAdjustment && (
            <BCTypography variant="body2" sx={{ mb: 2 }}>
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

          {/* Not subject to assessment section - Show for all report types */}
          {shouldShowNonAssessmentSection && (
            <BCBox
              mt={
                currentStatus === COMPLIANCE_REPORT_STATUSES.SUBMITTED ? 3 : 2
              }
            >
              <BCBox display="flex" alignItems="center" mb={2}>
                <BCTypography variant="h6" color="primary">
                  {t('report:notSubjectToAssessment')}
                </BCTypography>
                <Fade in={showSavedConfirmation}>
                  <BCBox display="flex" alignItems="center" ml={2}>
                    <CheckCircle
                      sx={{
                        color: 'success.main',
                        fontSize: '1rem',
                        mr: 0.5
                      }}
                    />
                    <BCTypography variant="body2" color="success.main">
                      Saved
                    </BCTypography>
                  </BCBox>
                </Fade>
              </BCBox>
              <FormControlLabel
                control={
                  <Checkbox
                    disabled={!canEditNonAssessmentStatus}
                    checked={methods.watch('isNonAssessment') || false}
                    onChange={handleNonAssessmentChange}
                  />
                }
                label={t('report:notSubjectToAssessmentDescription')}
                sx={{
                  alignItems: 'flex-start',
                  '& .MuiCheckbox-root': {
                    paddingTop: 0,
                    marginTop: '6px'
                  },
                  '& .MuiFormControlLabel-label': {
                    fontSize: '1rem',
                    lineHeight: 1.5
                  }
                }}
              />
            </BCBox>
          )}
        </>
      )}

      {shouldShowReassessmentButton && (
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
