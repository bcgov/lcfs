import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Divider,
  IconButton,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
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
  useEvidenceRequirements
} from '@/hooks/useInitiativeAgreements'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useInitiativeAgreementPageStore } from '@/stores/useInitiativeAgreementPageStore'
import { InitiativeAgreementTabs } from './components/InitiativeAgreementTabs'
import { DocumentTree } from './components/DocumentTree'
import { EvidenceOfCompletion } from './components/EvidenceOfCompletion'
import { DesignatedActionWorkflow } from './components/DesignatedActionWorkflow'
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

  // Surface the wireframe's action identifier in the breadcrumb.
  const setAgreementCrumb = useInitiativeAgreementPageStore(
    (state) => state.setAgreementCrumb
  )
  useEffect(() => {
    setAgreementCrumb(
      action
        ? `DA${action.actionNumber}-IA${action.initiativeAgreementId}`
        : null
    )
    return () => setAgreementCrumb(null)
  }, [action, setAgreementCrumb])

  if (isLoading) {
    return <Loading message={t('initiativeAgreement:loadingText')} />
  }

  if (isError || !action) {
    return (
      <BCBox>
        <InitiativeAgreementTabs />
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

      <Stepper
        alternativeLabel
        sx={{ mb: 3, maxWidth: 640 }}
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
              <BCBox sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton
                  size="small"
                  data-test="previous-action-button"
                  aria-label={t(
                    'initiativeAgreement:actionDetail.previousAction'
                  )}
                  disabled={!previousId}
                  onClick={() => goToSibling(previousId)}
                >
                  <ChevronLeftIcon />
                </IconButton>
                <BCTypography variant="body4">{actionLabel}</BCTypography>
                <IconButton
                  size="small"
                  data-test="next-action-button"
                  aria-label={t('initiativeAgreement:actionDetail.nextAction')}
                  disabled={!nextId}
                  onClick={() => goToSibling(nextId)}
                >
                  <ChevronRightIcon />
                </IconButton>
              </BCBox>
            </BCBox>

            <Stack spacing={0.5}>
              <LabelValue
                label={t('initiativeAgreement:actionDetail.creditsToBeIssued')}
                value={t('initiativeAgreement:actionDetail.upTo', {
                  count: (action.creditAllocation ?? 0).toLocaleString()
                })}
              />
              <LabelValue
                label={t('initiativeAgreement:actionDetail.recommendedCredits')}
                value={
                  action.recommendedCredits != null
                    ? action.recommendedCredits.toLocaleString()
                    : null
                }
              />
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

            <Paper
              variant="outlined"
              sx={{ p: 2, mt: 3 }}
              data-test="designated-action-documents-section"
            >
              <BCBox
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <BCTypography variant="h6" color="primary">
                  {t('initiativeAgreement:actionDetail.documents')}
                </BCTypography>
                {/* The folder tree arrives with #4925; evidence review
                    with #4899. Upload stays IDIR-side, like the API. */}
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
              </BCBox>
              <DocumentTree
                parentType={PARENT_TYPE}
                parentID={designatedActionId}
              />
            </Paper>
          </BCBox>
        }
      />

      {/* Evidence of completion review (#4899). The Accept and Request
          additional information buttons belong to the workflow story. */}
      <Role roles={[roles.ia_analyst, roles.ia_manager, roles.director]}>
        <EvidenceOfCompletion designatedActionId={designatedActionId} />
      </Role>

      {/* Workflow actions (#4898). Which buttons appear comes from the
          API, so the page cannot offer a transition the server refuses. */}
      <Role roles={[roles.ia_analyst, roles.ia_manager, roles.director]}>
        <DesignatedActionWorkflow
          designatedActionId={designatedActionId}
          availableActions={action.availableActions}
          recommendedCredits={action.recommendedCredits}
          creditAllocation={action.creditAllocation}
          allEvidenceSatisfactory={allEvidenceSatisfactory}
          canEditCredits={canRecommend}
          onChanged={refreshAction}
        />
      </Role>

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
