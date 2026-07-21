import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  FormControlLabel,
  FormHelperText,
  OutlinedInput,
  Radio,
  RadioGroup,
  Stack
} from '@mui/material'

import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import Comments from '@/components/Comments'
import { Role } from '@/components/Role'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'
import {
  useCompleteCIApplicationVerification1,
  useCompleteCIApplicationVerification2,
  useGenerateCIApplicationFuelCodes,
  useRecommendCIApplication,
  useRequestCIApplicationPathwayChanges,
  useRequestCIApplicationDocumentation,
  useRecordCIDecision
} from '@/hooks/useCIApplication'
import colors from '@/themes/base/colors'

type GovernmentDecisionStepProps = {
  ciApplication: any
  isGovernment?: boolean
  readOnly?: boolean
  onSupplierRequest?:
    | ((requestType: 'documentation' | 'pathwayChanges') => void)
    | null
  showDecisionPanel?: boolean
  showComments?: boolean
  showTitle?: boolean
  showCommentsTitle?: boolean
}

export const GovernmentDecisionStep = ({
  ciApplication,
  isGovernment = false,
  readOnly = false,
  onSupplierRequest = null,
  showDecisionPanel = true,
  showComments = true,
  showTitle = true,
  showCommentsTitle = false
}: GovernmentDecisionStepProps) => {
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
  const {
    mutateAsync: requestPathwayChanges,
    isPending: isRequestingPathwayChanges
  } = useRequestCIApplicationPathwayChanges(ciApplicationId)
  const {
    mutateAsync: requestDocumentation,
    isPending: isRequestingDocumentation
  } = useRequestCIApplicationDocumentation(ciApplicationId)
  const { mutateAsync: generateFuelCodes, isPending: isGeneratingFuelCodes } =
    useGenerateCIApplicationFuelCodes(ciApplicationId)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const status = ciApplication?.status?.status
  const isDirector = hasAnyRole?.(roles.director)
  const isAnalyst = hasAnyRole?.(roles.analyst)
  const isComplianceManager = hasAnyRole?.(roles.compliance_manager)
  const hasWorkflowRole = isAnalyst || isComplianceManager || isDirector
  const isRecommended = status === 'Recommended'
  const isSubmitted = status === 'Submitted'
  const isWithdrawn = status === 'Withdrawn'
  const [riskAssessment, setRiskAssessment] = useState(
    ciApplication?.preliminaryRiskAssessment || 'Low'
  )
  const [priorityScore, setPriorityScore] = useState(
    ciApplication?.priorityScore || ''
  )
  const [requestedPathwayChanges, setRequestedPathwayChanges] = useState(false)
  const [requestedDocumentation, setRequestedDocumentation] = useState(false)
  const [
    isRequestDocumentationConfirmOpen,
    setIsRequestDocumentationConfirmOpen
  ] = useState(false)
  const [priorityScoreTouched, setPriorityScoreTouched] = useState(false)
  const [
    priorityScoreVerificationAttempted,
    setPriorityScoreVerificationAttempted
  ] = useState(false)

  const priorityScoreNumber = Number(priorityScore)
  const isPriorityScoreValid =
    priorityScore !== '' &&
    Number.isInteger(priorityScoreNumber) &&
    priorityScoreNumber >= 1 &&
    priorityScoreNumber <= 999
  const priorityScoreError =
    ((priorityScoreTouched && priorityScore !== '') ||
      priorityScoreVerificationAttempted) &&
    !isPriorityScoreValid
      ? t('carbonIntensity:step5.priorityScoreInvalid')
      : null

  const normalizeRisk = (risk?: string | null) =>
    risk === 'Moderate' ? 'Medium' : risk

  const isLowOrModerateRisk = (risk?: string | null) =>
    ['Low', 'Medium'].includes(normalizeRisk(risk) || '')

  const isLowModerateOrHighRisk = (risk?: string | null) =>
    ['Low', 'Medium', 'High'].includes(normalizeRisk(risk) || '')

  const generatedFuelCodeRequiredFields = [
    'prefixId',
    'fuelSuffix',
    'carbonIntensity',
    'edrms',
    'company',
    'applicationDate',
    'approvalDate',
    'effectiveDate',
    'expirationDate',
    'fuelTypeId',
    'feedstock',
    'feedstockLocation'
  ]

  const isGeneratedFuelCodeReady = (row: any) =>
    row?.isValid === true ||
    generatedFuelCodeRequiredFields.every((field) => {
      const value = row?.[field]
      return value !== undefined && value !== null && value !== ''
    })

  const recordDecisionFor = async (nextStatus: string) => {
    setError(null)
    setSuccess(null)
    try {
      await recordDecision({ status: nextStatus })
      setSuccess(t('carbonIntensity:step5.decisionSuccess'))
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to record decision.'
      )
    }
  }

  const recordWorkflowAction = async (
    action: () => Promise<any>,
    successMessage: string
  ) => {
    setError(null)
    setSuccess(null)
    try {
      await action()
      setSuccess(successMessage)
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to update workflow.'
      )
    }
  }

  const preliminaryRisk = normalizeRisk(
    ciApplication?.preliminaryRiskAssessment
  )
  const verification2Risk = normalizeRisk(
    ciApplication?.verification2RiskAssessment
  )
  const requiresVerification2 =
    preliminaryRisk === 'Medium' || preliminaryRisk === 'High'
  const fuelPathwayCount = ciApplication?.pathways?.length || 0
  const generatedFuelCodesCount = ciApplication?.generatedFuelCodes?.length || 0
  const generatedFuelCodesReady =
    generatedFuelCodesCount > 0 &&
    ciApplication?.generatedFuelCodes?.every(isGeneratedFuelCodeReady)
  const showVerification1Panel =
    hasWorkflowRole && isSubmitted && !ciApplication?.verification1Date
  const showVerification2Panel =
    hasWorkflowRole &&
    isSubmitted &&
    ciApplication?.verification1Date &&
    requiresVerification2 &&
    !ciApplication?.verification2Date
  const showRecommendPanel =
    hasWorkflowRole &&
    isSubmitted &&
    ciApplication?.verification1Date &&
    (!requiresVerification2 || ciApplication?.verification2Date) &&
    !ciApplication?.recommendationDate &&
    generatedFuelCodesReady
  const canGenerateAfterVerification1 =
    ciApplication?.verification1Date &&
    !requiresVerification2 &&
    isLowOrModerateRisk(preliminaryRisk)
  const canGenerateAfterVerification2 =
    ciApplication?.verification2Date &&
    isLowModerateOrHighRisk(verification2Risk || preliminaryRisk)
  const showGenerateFuelCodesButton =
    hasWorkflowRole &&
    isSubmitted &&
    (canGenerateAfterVerification1 || canGenerateAfterVerification2) &&
    !ciApplication?.recommendationDate &&
    generatedFuelCodesCount === 0
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

  const handleRequestDocumentation = () => {
    // Ask the analyst to confirm the request rather than opening the upload
    // utility or firing silently (#4651). Cancelling leaves the button enabled;
    // only confirming performs the action and disables it.
    setIsRequestDocumentationConfirmOpen(true)
  }

  const confirmRequestDocumentation = () => {
    // Enable additional-document uploads for the supplier on the submitted
    // application (#4644), mirroring the pathway-changes request. Persists
    // document_upload_enabled so the BCeID user gets an upload path.
    setIsRequestDocumentationConfirmOpen(false)
    setRequestedDocumentation(true)
    onSupplierRequest?.('documentation')
    recordWorkflowAction(
      () => requestDocumentation(),
      t('carbonIntensity:step5.workflowSuccess')
    )
  }

  const handleRequestPathwayChanges = () => {
    setRequestedPathwayChanges(true)
    onSupplierRequest?.('pathwayChanges')
    recordWorkflowAction(
      () => requestPathwayChanges(),
      t('carbonIntensity:step5.workflowSuccess')
    )
  }

  const requireValidPriorityScore = () => {
    setPriorityScoreTouched(true)
    setPriorityScoreVerificationAttempted(true)
    if (isPriorityScoreValid) return priorityScoreNumber
    setError(t('carbonIntensity:step5.priorityScoreInvalid'))
    setSuccess(null)
    return null
  }

  const handleCompleteVerification1 = () => {
    const validPriorityScore = requireValidPriorityScore()
    if (validPriorityScore === null) return

    recordWorkflowAction(
      () =>
        completeVerification1({
          preliminaryRiskAssessment: riskAssessment,
          priorityScore: validPriorityScore
        } as any),
      t('carbonIntensity:step5.workflowSuccess')
    )
  }

  const handleCompleteVerification2 = () => {
    const validPriorityScore = requireValidPriorityScore()
    if (validPriorityScore === null) return

    recordWorkflowAction(
      () =>
        completeVerification2({
          preliminaryRiskAssessment: riskAssessment,
          priorityScore: validPriorityScore
        } as any),
      t('carbonIntensity:step5.workflowSuccess')
    )
  }

  return (
    <Box>
      {showTitle && (
        <BCTypography variant="h6" sx={{ pb: 2, color: colors.primary.main }}>
          {t('carbonIntensity:step5.title')}
        </BCTypography>
      )}

      {error && (
        <BCAlert severity="error" sx={{ mb: 1 }}>
          {error}
        </BCAlert>
      )}
      {success && (
        <BCAlert severity="success" sx={{ mb: 1 }}>
          {success}
        </BCAlert>
      )}

      {showDecisionPanel && isGovernment && (
        <Role
          roles={[
            roles.government,
            roles.analyst,
            roles.compliance_manager,
            roles.director
          ]}
        >
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
                  <Stack spacing={0.5}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <BCTypography variant="body2" sx={{ fontWeight: 700 }}>
                        {t('carbonIntensity:step5.priorityScore')}:
                      </BCTypography>
                      <OutlinedInput
                        type="text"
                        inputProps={{
                          'data-test': 'ci-priority-score-input',
                          inputMode: 'numeric',
                          pattern: '[0-9]*',
                          min: 1,
                          max: 999
                        }}
                        value={priorityScore}
                        error={!!priorityScoreError}
                        onBlur={() => setPriorityScoreTouched(true)}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          if (!/^\d*$/.test(nextValue)) return
                          if (nextValue === '') {
                            setPriorityScore('')
                            return
                          }
                          const numericValue = Number(nextValue)
                          setPriorityScore(
                            Math.min(numericValue, 999).toString()
                          )
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
                    {priorityScoreError && (
                      <FormHelperText error sx={{ m: 0 }}>
                        {priorityScoreError}
                      </FormHelperText>
                    )}
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
                  onClick={handleCompleteVerification1}
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
                  onClick={handleCompleteVerification2}
                  data-test="ci-verification-2-complete-btn"
                >
                  {t('carbonIntensity:step5.verification2Complete')}
                </BCButton>
              )}
              {showGenerateFuelCodesButton && (
                <BCButton
                  type="button"
                  variant="contained"
                  color="primary"
                  sx={workflowButtonSx}
                  disabled={readOnly || isGeneratingFuelCodes}
                  onClick={() =>
                    recordWorkflowAction(
                      () => generateFuelCodes(),
                      t('carbonIntensity:step5.workflowSuccess')
                    )
                  }
                  data-test="ci-generate-fuel-codes-btn"
                >
                  {t('carbonIntensity:step5.generateFuelCodes')}
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
              {hasWorkflowRole && isSubmitted && (
                <>
                  <BCButton
                    type="button"
                    variant="outlined"
                    color="primary"
                    sx={workflowButtonSx}
                    disabled={
                      readOnly ||
                      requestedDocumentation ||
                      !!ciApplication?.documentUploadEnabled ||
                      isRequestingDocumentation
                    }
                    onClick={handleRequestDocumentation}
                    data-test="ci-request-documentation-btn"
                  >
                    {t('carbonIntensity:step5.requestDocumentation')}
                  </BCButton>
                  <BCButton
                    type="button"
                    variant="outlined"
                    color="primary"
                    sx={workflowButtonSx}
                    disabled={
                      readOnly ||
                      requestedPathwayChanges ||
                      !!ciApplication?.pathwaySupplementalEditEnabled ||
                      isRequestingPathwayChanges
                    }
                    onClick={handleRequestPathwayChanges}
                    data-test="ci-request-pathway-changes-btn"
                  >
                    {t('carbonIntensity:step5.requestPathwayChanges')}
                  </BCButton>
                </>
              )}
              {isGovernment && (isSubmitted || isRecommended) && (
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
              )}
              {isGovernment && isWithdrawn && (
                <BCButton
                  type="button"
                  variant="contained"
                  color="primary"
                  sx={workflowButtonSx}
                  disabled={isDeciding}
                  onClick={() => recordDecisionFor('Submitted')}
                  data-test="ci-step5-reactivate-btn"
                >
                  {t('carbonIntensity:step5.reactivateBtn')}
                </BCButton>
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
      <BCModal
        open={isRequestDocumentationConfirmOpen}
        onClose={() => setIsRequestDocumentationConfirmOpen(false)}
        data={{
          title: t('carbonIntensity:step5.requestDocumentationConfirmTitle'),
          primaryButtonText: t('carbonIntensity:step5.requestDocumentation'),
          primaryButtonAction: confirmRequestDocumentation,
          secondaryButtonText: t('common:cancelBtn'),
          content: (
            <BCTypography variant="body1">
              {t('carbonIntensity:step5.requestDocumentationConfirmText')}
            </BCTypography>
          )
        }}
      />
    </Box>
  )
}

GovernmentDecisionStep.displayName = 'GovernmentDecisionStep'
