import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  FormControl,
  FormControlLabel,
  OutlinedInput,
  Radio,
  RadioGroup,
  Stack
} from '@mui/material'

import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import Comments from '@/components/Comments'
import { Role } from '@/components/Role'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'
import {
  useCompleteCIApplicationVerification1,
  useCompleteCIApplicationVerification2,
  useRecommendCIApplication,
  useRecordCIDecision
} from '@/hooks/useCIApplication'
import colors from '@/themes/base/colors'

/**
 * Step 5 — Government decision. Renders the shared comments widget
 * (entityType="ciApplication", commentMode="dual" — gov posts Internal
 * or Public, BCeID posts Public-only) plus, for government users, a
 * panel to record the terminal decision.
 */
export const GovernmentDecisionStep = ({
  ciApplication,
  isGovernment = false,
  readOnly = false,
  onDocumentUploadClick = null,
  showDecisionPanel = true,
  showComments = true,
  showTitle = true,
  showCommentsTitle = true
}) => {
  const { t } = useTranslation(['common', 'carbonIntensity'])
  const ciApplicationId = ciApplication?.ciApplicationId
  const { hasAnyRole } = useCurrentUser()

  const { mutateAsync: recordDecision, isPending: isDeciding } =
    useRecordCIDecision(ciApplicationId)
  const { mutateAsync: completeVerification1, isPending: isVerifying1 } =
    useCompleteCIApplicationVerification1(ciApplicationId)
  const { mutateAsync: completeVerification2, isPending: isVerifying2 } =
    useCompleteCIApplicationVerification2(ciApplicationId)
  const { mutateAsync: recommendToDirector, isPending: isRecommending } =
    useRecommendCIApplication(ciApplicationId)

  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const status = ciApplication?.status?.status
  const isDirector = hasAnyRole?.(roles.director)
  const isAnalyst = hasAnyRole?.(roles.analyst)
  const isRecommended = status === 'Recommended'
  const isApproved = status === 'Completed'
  const isSubmitted = status === 'Submitted'
  const [riskAssessment, setRiskAssessment] = useState(
    ciApplication?.preliminaryRiskAssessment || 'Low'
  )
  const [priorityScore, setPriorityScore] = useState(
    ciApplication?.priorityScore || ''
  )

  const recordDecisionFor = async (status) => {
    setError(null)
    setSuccess(null)
    try {
      await recordDecision({ status })
      setSuccess(t('carbonIntensity:step5.decisionSuccess'))
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to record decision.'
      )
    }
  }

  const recordWorkflowAction = async (action, successMessage) => {
    setError(null)
    setSuccess(null)
    try {
      await action()
      setSuccess(successMessage)
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to update workflow.'
      )
    }
  }

  const requiresVerification2 =
    ciApplication?.preliminaryRiskAssessment === 'Medium' ||
    ciApplication?.preliminaryRiskAssessment === 'High'
  const fuelPathwayCount = ciApplication?.pathways?.length || 0
  const showVerification1Panel =
    isAnalyst && isSubmitted && !ciApplication?.verification1Date
  const showVerification2Panel =
    isAnalyst &&
    isSubmitted &&
    ciApplication?.verification1Date &&
    requiresVerification2 &&
    !ciApplication?.verification2Date
  const showRecommendPanel =
    isAnalyst &&
    isSubmitted &&
    ciApplication?.verification1Date &&
    (!requiresVerification2 || ciApplication?.verification2Date) &&
    !ciApplication?.recommendationDate
  const showDirectorDecisionPanel = isDirector && isRecommended
  const activeVerificationLabel = showVerification2Panel
    ? 'Verification 2'
    : 'Verification 1'

  const workflowButtonSx = {
    minHeight: 44,
    px: 2,
    fontSize: '1rem',
    textTransform: 'none'
  }

  return (
    <Box>
      {showTitle && (
        <BCTypography variant="h6" sx={{ pb: 2, color: colors.primary.main }}>
          {t('carbonIntensity:step5.title')}
        </BCTypography>
      )}

      {error && (
        <BCAlert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </BCAlert>
      )}
      {success && (
        <BCAlert
          severity="success"
          sx={{ mb: 1 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </BCAlert>
      )}

      {showDecisionPanel && isGovernment && (
        <Role roles={[roles.government, roles.analyst, roles.director]}>
          <Box
            sx={{
              bgcolor: 'background.grey',
              p: 2,
              mb: 3,
              borderRadius: 1
            }}
            data-test="ci-step5-decision-panel"
          >
            {(showVerification1Panel || showVerification2Panel) && (
              <>
                <BCTypography
                  variant="h6"
                  sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}
                >
                  {activeVerificationLabel}
                </BCTypography>
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={4}
                  alignItems={{ xs: 'flex-start', lg: 'center' }}
                  sx={{ mb: 2 }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <BCTypography variant="body2" sx={{ fontWeight: 700 }}>
                      {t('carbonIntensity:step5.riskAssessment')}:
                    </BCTypography>
                    <RadioGroup
                      row
                      value={riskAssessment}
                      onChange={(event) =>
                        setRiskAssessment(event.target.value)
                      }
                      spacing={2}
                    >
                      <FormControlLabel
                        labelPlacement="start"
                        sx={{ mr: 3 }}
                        value="Low"
                        control={<Radio size="small" />}
                        label="Low"
                        disabled={readOnly}
                      />
                      <FormControlLabel
                        labelPlacement="start"
                        sx={{ mr: 3 }}
                        value="Medium"
                        control={<Radio size="small" />}
                        label="Moderate"
                        disabled={readOnly}
                      />
                      <FormControlLabel
                        labelPlacement="start"
                        sx={{ mr: 3 }}
                        value="High"
                        control={<Radio size="small" />}
                        label="High"
                        disabled={readOnly}
                      />
                    </RadioGroup>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <BCTypography variant="body2" sx={{ fontWeight: 700 }}>
                      {t('carbonIntensity:step5.priorityScore')}:
                    </BCTypography>
                    <OutlinedInput
                      type="number"
                      min={0}
                      max={1000}
                      value={priorityScore}
                      onChange={(event) => {
                        let value = Number(event.target.value)
                        if (value < 0) value = 0
                        if (value > 1000) value = 1000
                        setPriorityScore(value.toString())
                      }}
                      disabled={readOnly}
                      sx={{
                        width: 106,
                        height: 42,
                        border: 1,
                        borderColor: 'grey.400',
                        bgcolor: 'common.white',
                        color: 'primary.main',
                        fontWeight: 700,
                        fontSize: '1rem',
                        textAlign: 'center',
                        '& input': {
                          p: 0,
                          textAlign: 'center'
                        }
                      }}
                    />
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <BCTypography variant="body2" sx={{ fontWeight: 700 }}>
                      {t('carbonIntensity:step5.numberOfFuelPathways')}:
                    </BCTypography>
                    <BCTypography variant="body2">
                      {fuelPathwayCount}
                    </BCTypography>
                  </Stack>
                </Stack>
              </>
            )}

            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {showVerification1Panel && (
                <BCButton
                  type="button"
                  variant="contained"
                  color="primary"
                  sx={workflowButtonSx}
                  disabled={readOnly || isVerifying1}
                  onClick={() =>
                    recordWorkflowAction(
                      () =>
                        completeVerification1({
                          preliminaryRiskAssessment: riskAssessment,
                          priorityScore: priorityScore
                            ? Number(priorityScore)
                            : undefined
                        }),
                      t('carbonIntensity:step5.workflowSuccess')
                    )
                  }
                  data-test="ci-verification-1-complete-btn"
                >
                  {t('carbonIntensity:step5.verification1Complete')}
                </BCButton>
              )}
              {showVerification2Panel && (
                <BCButton
                  type="button"
                  variant="contained"
                  color="primary"
                  sx={workflowButtonSx}
                  disabled={readOnly || isVerifying2}
                  onClick={() =>
                    recordWorkflowAction(
                      () =>
                        completeVerification2({
                          preliminaryRiskAssessment: riskAssessment,
                          priorityScore: priorityScore
                            ? Number(priorityScore)
                            : undefined
                        }),
                      t('carbonIntensity:step5.workflowSuccess')
                    )
                  }
                  data-test="ci-verification-2-complete-btn"
                >
                  {t('carbonIntensity:step5.verification2Complete')}
                </BCButton>
              )}
              {showRecommendPanel && (
                <BCButton
                  type="button"
                  variant="contained"
                  color="primary"
                  sx={workflowButtonSx}
                  disabled={readOnly || isRecommending}
                  onClick={() =>
                    recordWorkflowAction(
                      () => recommendToDirector(),
                      t('carbonIntensity:step5.workflowSuccess')
                    )
                  }
                  data-test="ci-recommend-to-director-btn"
                >
                  {t('carbonIntensity:step5.recommendToDirector')}
                </BCButton>
              )}
              {isAnalyst && isSubmitted && (
                <>
                  <BCButton
                    type="button"
                    variant="outlined"
                    color="primary"
                    sx={workflowButtonSx}
                    disabled={readOnly || !onDocumentUploadClick}
                    onClick={onDocumentUploadClick || undefined}
                    data-test="ci-request-documentation-btn"
                  >
                    {t('carbonIntensity:step5.requestDocumentation')}
                  </BCButton>
                  <BCButton
                    type="button"
                    variant="outlined"
                    color="primary"
                    sx={workflowButtonSx}
                    disabled={readOnly}
                    data-test="ci-request-pathway-changes-btn"
                  >
                    {t('carbonIntensity:step5.requestPathwayChanges')}
                  </BCButton>
                  <BCButton
                    type="button"
                    variant="outlined"
                    color="error"
                    sx={workflowButtonSx}
                    disabled={readOnly || isDeciding}
                    onClick={() => recordDecisionFor('Withdrawn')}
                    data-test="ci-step5-withdraw-btn"
                  >
                    {t('carbonIntensity:step5.withdrawBtn')}
                  </BCButton>
                </>
              )}
              {showDirectorDecisionPanel && (
                <>
                  <BCButton
                    type="button"
                    variant="contained"
                    color="primary"
                    sx={workflowButtonSx}
                    disabled={readOnly || isDeciding}
                    onClick={() => recordDecisionFor('Completed')}
                    data-test="ci-approve-btn"
                  >
                    {t('carbonIntensity:step5.approveBtn')}
                  </BCButton>
                  <BCButton
                    type="button"
                    variant="outlined"
                    color="primary"
                    sx={workflowButtonSx}
                    disabled={readOnly || isDeciding}
                    onClick={() => recordDecisionFor('Submitted')}
                    data-test="ci-return-to-analyst-btn"
                  >
                    {t('carbonIntensity:step5.returnToAnalyst')}
                  </BCButton>
                </>
              )}
            </Stack>
          </Box>
        </Role>
      )}

      {showComments && (
        <Box sx={{ mb: 2 }} data-test="ci-step5-comments">
          {showCommentsTitle && (
            <BCTypography
              variant="h6"
              sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}
            >
              {t('carbonIntensity:step5.commentsToOrganizationHeader')}
            </BCTypography>
          )}
          {ciApplicationId ? (
            <Comments
              entityType="ciApplication"
              entityId={ciApplicationId}
              commentMode="dual"
            />
          ) : (
            <BCTypography variant="body2" color="text.secondary">
              {t('carbonIntensity:step5.noComments')}
            </BCTypography>
          )}
        </Box>
      )}
    </Box>
  )
}

GovernmentDecisionStep.displayName = 'GovernmentDecisionStep'
