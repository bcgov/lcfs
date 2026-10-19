import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import TextField from '@mui/material/TextField'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import InitiativeAgreementTabs from './components/InitiativeAgreementTabs'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Comments from '@/components/Comments'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { ROUTES, buildPath } from '@/routes/routes'
import { dateFormatter } from '@/utils/formatters'
import withRole from '@/utils/withRole'

import {
  useDesignatedActionProfile,
  useEvidenceRequirements,
  useSetRecommendedCredits
} from '@/hooks/useInitiativeAgreements'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useInitiativeAgreementPageStore } from '@/stores/useInitiativeAgreementPageStore'
import { DocumentTree } from './components/DocumentTree'
import { EvidenceOfCompletion } from './components/EvidenceOfCompletion'
import { OUTCOME_INFORMATION_REQUESTED } from './components/evidenceConstants'
import {
  DesignatedActionWorkflow,
  ACTION_REQUEST_INFORMATION,
  PLACEMENT_DECISION,
  PLACEMENT_EVIDENCE
} from './components/DesignatedActionWorkflow'
import { EditDesignatedAction } from './components/EditDesignatedAction'
import { DesignatedActionHistoryPanel } from './components/DesignatedActionHistoryPanel'

// The shared document machinery keys on this string for designated actions.
const PARENT_TYPE = 'designatedAction'

// The wireframe's workflow milestones, keyed by the status lookup's
// display_order: a status at or past the threshold completes the step.
const WORKFLOW_STEPS = [
  {
    labelKey: 'initiativeAgreement:actionDetail.steps.submissionReceived',
    threshold: 20
  },
  {
    labelKey: 'initiativeAgreement:actionDetail.steps.underway',
    threshold: 30
  },
  { labelKey: 'initiativeAgreement:actionDetail.steps.approved', threshold: 70 }
]

const LabelValue = ({ label, value }) => (
  <BCTypography variant="body4" component="p">
    <strong>{label}</strong> {value ?? '—'}
  </BCTypography>
)

const navButtonSx = {
  backgroundColor: '#003366',
  color: 'white !important',
  borderRadius: '50%',
  width: 25,
  height: 25,
  padding: 0,
  '& .MuiSvgIcon-root': {
    color: 'white',
    fontSize: '18px !important'
  },
  '&:hover': {
    backgroundColor: '#004080',
    '& .MuiSvgIcon-root': { color: 'white' }
  },
  '&.Mui-disabled': {
    backgroundColor: '#c0c0c0',
    color: '#808080'
  }
}

const DesignatedActionDetailBase = () => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const navigate = useNavigate()
  const { initiativeAgreementId, designatedActionId } = useParams()
  const [uploadOpen, setUploadOpen] = useState(false)

  const {
    data: action,
    isLoading,
    isError,
    error
  } = useDesignatedActionProfile(designatedActionId)

  const { hasRoles } = useCurrentUser()
  const canRecommend =
    hasRoles?.(roles.ia_analyst) || hasRoles?.(roles.ia_manager)

  const { data: requirements = [] } =
    useEvidenceRequirements(designatedActionId)

  // The recommended amount is edited here, beside the allocation it is
  // measured against, rather than at the foot of the page (#5079).
  const { mutate: saveCredits } = useSetRecommendedCredits(designatedActionId)
  const [credits, setCredits] = useState('')
  useEffect(() => {
    setCredits(
      action?.recommendedCredits === null ||
        action?.recommendedCredits === undefined
        ? ''
        : String(action.recommendedCredits)
    )
  }, [action?.recommendedCredits])
  const commitCredits = () => {
    const next = credits === '' ? null : Number(credits)
    // A number input sanitises garbage to '', but if a non-number ever
    // arrives it must not be saved as null and read as "cleared".
    if (next !== null && !Number.isInteger(next)) {
      setCredits(
        action?.recommendedCredits == null
          ? ''
          : String(action.recommendedCredits)
      )
      return
    }
    if (next !== (action?.recommendedCredits ?? null)) {
      saveCredits(next)
    }
  }
  const allEvidenceSatisfactory =
    requirements.length > 0 &&
    requirements.every((r) => r.reviewOutcome === 'Satisfactory')

  const queryClient = useQueryClient()
  const refreshAction = () => {
    queryClient.invalidateQueries({ queryKey: ['designated-actions'] })
    queryClient.invalidateQueries({ queryKey: ['evidence-requirements'] })
  }
  const refreshTree = () =>
    queryClient.invalidateQueries({
      queryKey: ['document-tree', PARENT_TYPE, String(designatedActionId)]
    })

  // The breadcrumb reads the hierarchy the URL encodes — the agreement,
  // then the action — so it needs a label for each numeric segment.
  const setAgreementCrumb = useInitiativeAgreementPageStore(
    (state) => state.setAgreementCrumb
  )
  const setParentCrumb = useInitiativeAgreementPageStore(
    (state) => state.setParentCrumb
  )
  useEffect(() => {
    setAgreementCrumb(
      action
        ? `DA${action.actionNumber}-IA${action.initiativeAgreementId}`
        : null
    )
    setParentCrumb(action?.iaCode ?? null)
    return () => {
      setAgreementCrumb(null)
      setParentCrumb(null)
    }
  }, [action, setAgreementCrumb, setParentCrumb])

  if (isLoading) {
    return <Loading message={t('initiativeAgreement:loadingText')} />
  }

  if (isError || !action) {
    return (
      <BCBox>
        <BCAlert data-test="alert-box" severity="error">
          {error?.message || t('initiativeAgreement:actionDetail.loadFailMsg')}
        </BCAlert>
      </BCBox>
    )
  }

  const displayOrder = action.currentStatus?.displayOrder ?? 0
  const actionLabel = `DA${action.actionNumber}-IA${action.initiativeAgreementId}`
  const siblings = action.siblingActionIds || []
  const currentIndex = siblings.indexOf(Number(designatedActionId))
  const previousId = currentIndex > 0 ? siblings[currentIndex - 1] : null
  const nextId =
    currentIndex >= 0 && currentIndex < siblings.length - 1
      ? siblings[currentIndex + 1]
      : null

  const goToSibling = (siblingId) =>
    navigate(
      buildPath(ROUTES.INITIATIVE_AGREEMENTS.ACTION_VIEW, {
        initiativeAgreementId,
        designatedActionId: siblingId
      })
    )

  const renderRequestAction = (
    requirement,
    allRequestsComplete,
    beforeRequest
  ) => {
    if (requirement.reviewOutcome !== OUTCOME_INFORMATION_REQUESTED) {
      return null
    }
    return (
      <DesignatedActionWorkflow
        key={`request-information-${requirement.evidenceRequirementId}`}
        designatedActionId={designatedActionId}
        availableActions={action.availableActions}
        onlyAction={ACTION_REQUEST_INFORMATION}
        canRequestInformation={allRequestsComplete}
        missingInformation={requirement.missingInformation ?? ''}
        beforeAction={beforeRequest}
        placement={PLACEMENT_EVIDENCE}
        onChanged={refreshAction}
      />
    )
  }

  const evidenceActions = requirements.length ? null : (
    <DesignatedActionWorkflow
      designatedActionId={designatedActionId}
      availableActions={action.availableActions}
      onlyAction={ACTION_REQUEST_INFORMATION}
      recommendedCredits={action.recommendedCredits}
      allEvidenceSatisfactory={allEvidenceSatisfactory}
      hasRequirements={requirements.length > 0}
      missingInformation={action.missingInformation ?? ''}
      placement={PLACEMENT_EVIDENCE}
      onChanged={refreshAction}
    />
  )

  return (
    <BCBox>
      <InitiativeAgreementTabs />
      <BCTypography
        variant="h5"
        color="primary"
        data-test="designated-action-detail-title"
      >
        {t('initiativeAgreement:actionDetail.title')}
        {action.iaCode ? ` - ${action.iaCode}` : ''}
      </BCTypography>
      <Divider sx={{ mt: 2, mb: 3 }} />

      {/* Centred on the page, per the design review (#5118). */}
      <Stepper
        alternativeLabel
        sx={{ mb: 3, maxWidth: 640, mx: 'auto' }}
        data-test="designated-action-stepper"
      >
        {WORKFLOW_STEPS.map((step) => (
          <Step key={step.labelKey} completed={displayOrder >= step.threshold}>
            <StepLabel>{t(step.labelKey)}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <BCWidgetCard
        title={t('initiativeAgreement:actionDetail.cardHeader')}
        color="nav"
        data-test="designated-action-card"
        headerAction={
          <EditDesignatedAction action={action} onChanged={refreshAction} />
        }
        content={
          <BCBox p={1}>
            <BCBox
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                mb: 2
              }}
            >
              <BCBox sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <BCTypography variant="h6" color="primary">
                  {action.actionNumber}. {action.name}
                </BCTypography>
                {action.currentStatus?.status && (
                  <BCBox
                    component="span"
                    data-test="action-status-chip"
                    sx={{
                      px: 1.5,
                      py: 0.25,
                      borderRadius: 4,
                      // success.contrastText is computed against
                      // success.main, so pairing it with the lighter shade
                      // gives 3.27:1 and fails AA.
                      bgcolor: 'success.main',
                      color: 'success.contrastText',
                      fontSize: '0.8rem'
                    }}
                  >
                    {action.currentStatus.status}
                  </BCBox>
                )}
              </BCBox>
              <BCBox sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BCButton
                  variant="contained"
                  color="primary"
                  iconOnly
                  size="small"
                  data-test="previous-action-button"
                  aria-label={t(
                    'initiativeAgreement:actionDetail.previousAction'
                  )}
                  disabled={!previousId}
                  onClick={() => goToSibling(previousId)}
                  sx={navButtonSx}
                >
                  <ChevronLeftIcon />
                </BCButton>
                <BCTypography variant="body4">{actionLabel}</BCTypography>
                <BCButton
                  variant="contained"
                  color="primary"
                  iconOnly
                  size="small"
                  data-test="next-action-button"
                  aria-label={t('initiativeAgreement:actionDetail.nextAction')}
                  disabled={!nextId}
                  onClick={() => goToSibling(nextId)}
                  sx={navButtonSx}
                >
                  <ChevronRightIcon />
                </BCButton>
              </BCBox>
            </BCBox>

            <Stack spacing={0.5}>
              <LabelValue
                label={t('initiativeAgreement:actionDetail.creditsToBeIssued')}
                value={t('initiativeAgreement:actionDetail.upTo', {
                  count: (action.creditAllocation ?? 0).toLocaleString()
                })}
              />
              {canRecommend ? (
                <BCBox
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexWrap: 'wrap'
                  }}
                >
                  <BCTypography
                    variant="body4"
                    component="label"
                    htmlFor="recommended-credits-input"
                    sx={{ fontWeight: 700 }}
                  >
                    {t('initiativeAgreement:actionDetail.recommendedCredits')}
                  </BCTypography>
                  <TextField
                    id="recommended-credits-input"
                    size="small"
                    type="number"
                    value={credits}
                    inputProps={{
                      min: 0,
                      max: action.creditAllocation ?? undefined,
                      'data-test': 'recommended-credits-input'
                    }}
                    sx={{ width: 160 }}
                    onChange={(event) => setCredits(event.target.value)}
                    onBlur={commitCredits}
                  />
                </BCBox>
              ) : (
                <LabelValue
                  label={t(
                    'initiativeAgreement:actionDetail.recommendedCredits'
                  )}
                  value={
                    action.recommendedCredits != null
                      ? action.recommendedCredits.toLocaleString()
                      : null
                  }
                />
              )}
              <LabelValue
                label={t('initiativeAgreement:actionDetail.completionDate')}
                value={
                  action.specifiedDate
                    ? dateFormatter({ value: action.specifiedDate })
                    : null
                }
              />
              {action.completedDate && (
                <LabelValue
                  label={t('initiativeAgreement:actionDetail.completedDate')}
                  value={dateFormatter({ value: action.completedDate })}
                />
              )}
              {action.determination && (
                <LabelValue
                  label={t('initiativeAgreement:actionDetail.determination')}
                  value={action.determination}
                />
              )}
            </Stack>

            {/* The tree draws its own card, title and actions — wrapping
                it in a second bordered box with a second heading only
                made one section look like two. */}
            <BCBox
              sx={{ mt: 3 }}
              data-test="designated-action-documents-section"
            >
              <DocumentTree
                parentType={PARENT_TYPE}
                parentID={designatedActionId}
                enablePreview
                // Subfolders turned on at the business area's request
                // (2026-09-01), superseding the earlier one-level cap.
                allowSubfolders
                title={t('initiativeAgreement:actionDetail.documents')}
                headerAction={
                  // Upload stays IDIR-side, like the API.
                  <Role
                    roles={[roles.ia_analyst, roles.ia_manager, roles.director]}
                  >
                    <BCTypography
                      component="button"
                      variant="body4"
                      color="link"
                      data-test="upload-documents-button"
                      onClick={() => setUploadOpen(true)}
                      sx={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {t('initiativeAgreement:actionDetail.manageDocuments')}
                    </BCTypography>
                  </Role>
                }
              />
            </BCBox>
            <hr style={{ margin: '2rem 0' }} />
            <Role roles={[roles.ia_analyst, roles.ia_manager, roles.director]}>
              <EvidenceOfCompletion
                designatedActionId={designatedActionId}
                // The API takes evidence edits from analysts and managers
                // only; directors see the review without controls that
                // would be refused.
                canEdit={canRecommend}
                missingInformationReadOnly={!canRecommend}
                actions={evidenceActions}
                renderRequestAction={renderRequestAction}
              />
              <DesignatedActionWorkflow
                designatedActionId={designatedActionId}
                availableActions={action.availableActions}
                recommendedCredits={action.recommendedCredits}
                allEvidenceSatisfactory={allEvidenceSatisfactory}
                hasRequirements={requirements.length > 0}
                placement={PLACEMENT_DECISION}
                onChanged={refreshAction}
              />
            </Role>
          </BCBox>
        }
      />

      <DocumentUploadDialog
        open={uploadOpen}
        close={() => {
          setUploadOpen(false)
          refreshTree()
        }}
        parentType={PARENT_TYPE}
        parentID={designatedActionId}
      />

      {/* The audit trail behind every workflow step (#4898). */}
      <Role roles={[roles.ia_analyst, roles.ia_manager, roles.director]}>
        <DesignatedActionHistoryPanel designatedActionId={designatedActionId} />
      </Role>

      {/* Standard dual-mode thread (#4900); the page is IDIR-only until
          the BCeID story, matching the API. */}
      <BCBox mt={3} data-test="designated-action-comments-section">
        <Comments
          entityType="designatedAction"
          entityId={Number(designatedActionId)}
          commentMode="dual"
        />
      </BCBox>
    </BCBox>
  )
}

export const DesignatedActionDetail = withRole(
  DesignatedActionDetailBase,
  [roles.ia_analyst, roles.ia_manager, roles.director],
  ROUTES.DASHBOARD
)
DesignatedActionDetail.displayName = 'DesignatedActionDetail'
