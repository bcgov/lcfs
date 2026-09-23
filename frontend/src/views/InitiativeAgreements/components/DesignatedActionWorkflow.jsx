import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Stack, TextField, Tooltip } from '@mui/material'

import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { useDesignatedActionWorkflow } from '@/hooks/useInitiativeAgreements'

// Workflow actions for a designated action (#4898). Which buttons appear
// is decided by the API — availableActions comes from the same transition
// table the endpoint enforces, so the page can never offer an action the
// server would refuse.
export const ACTION_ACCEPT = 'accept_evidence'
export const ACTION_REQUEST_INFORMATION = 'request_information'
export const ACTION_RECOMMEND_TO_MANAGER = 'recommend_to_manager'
export const ACTION_NOT_RECOMMEND = 'not_recommend'
export const ACTION_RETURN = 'return'
export const ACTION_RECOMMEND_TO_DIRECTOR = 'recommend_to_director'
export const ACTION_APPROVE = 'approve'
export const ACTION_REJECT = 'reject'

// Actions that must say why. The API requires the comment too; asking for
// it here means the user finds out before they lose the click. Requesting
// information is the exception: its reason is the page's Missing
// information box (#5118), so it asks for nothing more.
const REQUIRES_COMMENT = new Set([
  ACTION_NOT_RECOMMEND,
  ACTION_RETURN,
  ACTION_REJECT
])

// Actions whose reason is asked for in their own words; the rest share
// the general prompt.
const PROMPT_KEYS = {
  [ACTION_NOT_RECOMMEND]: 'initiativeAgreement:workflow.prompt.not_recommend'
}

// Where on the page each action belongs (#5080). Evidence decisions sit
// beneath the review summary they act on; recommendation and approval
// decisions close the page. Same component, rendered once per placement.
export const PLACEMENT_EVIDENCE = 'evidence'
export const PLACEMENT_DECISION = 'decision'

const BUTTONS = [
  {
    action: ACTION_ACCEPT,
    labelKey: 'accept',
    variant: 'contained',
    colour: 'primary',
    placement: PLACEMENT_EVIDENCE
  },
  {
    action: ACTION_REQUEST_INFORMATION,
    labelKey: 'requestInformation',
    variant: 'outlined',
    colour: 'error',
    placement: PLACEMENT_EVIDENCE
  },
  {
    action: ACTION_RECOMMEND_TO_MANAGER,
    labelKey: 'recommendToManager',
    variant: 'contained',
    colour: 'primary',
    placement: PLACEMENT_DECISION
  },
  {
    action: ACTION_NOT_RECOMMEND,
    labelKey: 'notRecommended',
    variant: 'outlined',
    colour: 'primary',
    placement: PLACEMENT_DECISION
  },
  {
    action: ACTION_RECOMMEND_TO_DIRECTOR,
    labelKey: 'recommendToDirector',
    variant: 'contained',
    colour: 'primary',
    placement: PLACEMENT_DECISION
  },
  {
    action: ACTION_APPROVE,
    labelKey: 'approve',
    variant: 'contained',
    colour: 'primary',
    placement: PLACEMENT_DECISION
  },
  {
    action: ACTION_RETURN,
    labelKey: 'return',
    variant: 'outlined',
    colour: 'primary',
    placement: PLACEMENT_DECISION
  },
  {
    action: ACTION_REJECT,
    labelKey: 'reject',
    variant: 'outlined',
    colour: 'error',
    placement: PLACEMENT_DECISION
  }
]

export const DesignatedActionWorkflow = ({
  designatedActionId,
  availableActions = [],
  recommendedCredits,
  allEvidenceSatisfactory,
  hasRequirements = true,
  // The Missing information box's current text; it is what a request for
  // additional information sends.
  missingInformation = '',
  // Omitted: every available action, as before the split.
  placement,
  onChanged
}) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [pendingAction, setPendingAction] = useState(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  const { mutate: performAction, isPending } =
    useDesignatedActionWorkflow(designatedActionId)

  const run = (action, payload = {}) => {
    setError('')
    performAction(
      { action, ...payload },
      {
        onSuccess: () => {
          setPendingAction(null)
          setComment('')
          onChanged?.()
        },
        onError: (err) => {
          setError(
            err?.response?.data?.detail ||
              err?.message ||
              t('initiativeAgreement:workflow.actionFailed')
          )
        }
      }
    )
  }

  const start = (action) => {
    setError('')
    if (REQUIRES_COMMENT.has(action)) {
      setPendingAction(action)
      return
    }
    if (action === ACTION_REQUEST_INFORMATION) {
      run(action, { comment: missingInformation.trim() })
      return
    }
    if (action === ACTION_RECOMMEND_TO_MANAGER) {
      // The amount lives in the header now (#5079); the action carries
      // whatever is saved there.
      run(action, { recommendedCredits: recommendedCredits ?? null })
      return
    }
    run(action)
  }

  const visible = BUTTONS.filter(
    (button) =>
      availableActions.includes(button.action) &&
      (!placement || button.placement === placement)
  )
  // Nothing to offer here: render nothing rather than an empty block
  // with its own margin.
  if (visible.length === 0 && !error) return null

  // Accepting and recommending both need every requirement satisfactory;
  // showing that as a disabled button explains itself better than a
  // rejected click would.
  const blockedByEvidence = (action) =>
    (action === ACTION_ACCEPT || action === ACTION_RECOMMEND_TO_MANAGER) &&
    !allEvidenceSatisfactory
  const blockedByMissingInformation = (action) =>
    action === ACTION_REQUEST_INFORMATION && !missingInformation.trim()

  // A disabled button should say what would enable it, not just refuse.
  const tooltipFor = (action) => {
    if (blockedByEvidence(action)) {
      return hasRequirements
        ? t('initiativeAgreement:workflow.blockedByEvidence')
        : t('initiativeAgreement:workflow.blockedNoRequirements')
    }
    if (blockedByMissingInformation(action)) {
      return t('initiativeAgreement:workflow.blockedNoMissingInformation')
    }
    return t(`initiativeAgreement:workflow.tip.${action}`)
  }

  const commentPrompt = t(
    PROMPT_KEYS[pendingAction] ?? 'initiativeAgreement:workflow.commentPrompt'
  )

  return (
    <BCBox
      mt={placement === PLACEMENT_EVIDENCE ? 2 : 3}
      data-test={
        placement
          ? `designated-action-workflow-${placement}`
          : 'designated-action-workflow'
      }
    >
      {error && (
        <BCTypography
          variant="body4"
          color="error"
          component="p"
          data-test="workflow-error"
          sx={{ mb: 1 }}
        >
          {error}
        </BCTypography>
      )}

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {visible.map((button) => (
          // The span keeps the tooltip working while the button is
          // disabled — a disabled control fires no pointer events.
          <Tooltip key={button.action} title={tooltipFor(button.action)}>
            <span data-test={`workflow-tip-${button.action}`}>
              <BCButton
                type="button"
                variant={button.variant}
                color={button.colour}
                size="small"
                disabled={
                  isPending ||
                  blockedByEvidence(button.action) ||
                  blockedByMissingInformation(button.action)
                }
                data-test={`workflow-${button.action}`}
                onClick={() => start(button.action)}
              >
                {t(`initiativeAgreement:workflow.${button.labelKey}`)}
              </BCButton>
            </span>
          </Tooltip>
        ))}
      </Stack>

      <BCModal
        open={!!pendingAction}
        onClose={() => {
          setPendingAction(null)
          setComment('')
        }}
        data={{
          title: pendingAction
            ? t(`initiativeAgreement:workflow.confirm.${pendingAction}`)
            : '',
          primaryButtonText: t('initiativeAgreement:workflow.submit'),
          primaryButtonAction: () => run(pendingAction, { comment }),
          primaryButtonDisabled: !comment.trim(),
          secondaryButtonText: t('common:cancelBtn'),
          content: (
            <Box sx={{ minWidth: { xs: 'auto', sm: 420 } }}>
              <BCTypography variant="body4" component="p" sx={{ mb: 1 }}>
                {commentPrompt}
              </BCTypography>
              <TextField
                multiline
                minRows={4}
                fullWidth
                autoFocus
                value={comment}
                inputProps={{
                  'data-test': 'workflow-comment',
                  'aria-label': commentPrompt
                }}
                onChange={(event) => setComment(event.target.value)}
              />
            </Box>
          )
        }}
      />
    </BCBox>
  )
}

export default DesignatedActionWorkflow
