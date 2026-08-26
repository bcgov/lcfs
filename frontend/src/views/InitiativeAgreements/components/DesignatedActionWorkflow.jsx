import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Stack, TextField } from '@mui/material'

import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import {
  useDesignatedActionWorkflow,
  useSetRecommendedCredits
} from '@/hooks/useInitiativeAgreements'

// Workflow actions for a designated action (#4898). Which buttons appear
// is decided by the API — availableActions comes from the same transition
// table the endpoint enforces, so the page can never offer an action the
// server would refuse.
export const ACTION_ACCEPT = 'accept_evidence'
export const ACTION_REQUEST_INFORMATION = 'request_information'
export const ACTION_RECOMMEND_TO_MANAGER = 'recommend_to_manager'
export const ACTION_RETURN = 'return'
export const ACTION_RECOMMEND_TO_DIRECTOR = 'recommend_to_director'
export const ACTION_APPROVE = 'approve'
export const ACTION_REJECT = 'reject'

// Actions that must say why. The API requires the comment too; asking for
// it here means the user finds out before they lose the click.
const REQUIRES_COMMENT = new Set([
  ACTION_REQUEST_INFORMATION,
  ACTION_RETURN,
  ACTION_REJECT
])

const BUTTONS = [
  {
    action: ACTION_ACCEPT,
    labelKey: 'accept',
    variant: 'outlined',
    colour: 'primary'
  },
  {
    action: ACTION_REQUEST_INFORMATION,
    labelKey: 'requestInformation',
    variant: 'outlined',
    colour: 'error'
  },
  {
    action: ACTION_RECOMMEND_TO_MANAGER,
    labelKey: 'recommendToManager',
    variant: 'contained',
    colour: 'primary'
  },
  {
    action: ACTION_RECOMMEND_TO_DIRECTOR,
    labelKey: 'recommendToDirector',
    variant: 'contained',
    colour: 'primary'
  },
  {
    action: ACTION_APPROVE,
    labelKey: 'approve',
    variant: 'contained',
    colour: 'primary'
  },
  {
    action: ACTION_RETURN,
    labelKey: 'return',
    variant: 'outlined',
    colour: 'primary'
  },
  {
    action: ACTION_REJECT,
    labelKey: 'reject',
    variant: 'outlined',
    colour: 'error'
  }
]

export const DesignatedActionWorkflow = ({
  designatedActionId,
  availableActions = [],
  recommendedCredits,
  creditAllocation,
  allEvidenceSatisfactory,
  canEditCredits = false,
  onChanged
}) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [pendingAction, setPendingAction] = useState(null)
  const [comment, setComment] = useState('')
  const [credits, setCredits] = useState(
    recommendedCredits === null || recommendedCredits === undefined
      ? ''
      : String(recommendedCredits)
  )
  const [error, setError] = useState('')

  const { mutate: performAction, isPending } =
    useDesignatedActionWorkflow(designatedActionId)
  const { mutate: saveCredits } = useSetRecommendedCredits(designatedActionId)

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
    if (action === ACTION_RECOMMEND_TO_MANAGER) {
      run(action, {
        recommendedCredits: credits === '' ? null : Number(credits)
      })
      return
    }
    run(action)
  }

  const visible = BUTTONS.filter((button) =>
    availableActions.includes(button.action)
  )

  // Accepting and recommending both need every requirement satisfactory;
  // showing that as a disabled button explains itself better than a
  // rejected click would.
  const blockedByEvidence = (action) =>
    (action === ACTION_ACCEPT || action === ACTION_RECOMMEND_TO_MANAGER) &&
    !allEvidenceSatisfactory

  return (
    <BCBox mt={3} data-test="designated-action-workflow">
      {canEditCredits && (
        <Box sx={{ mb: 2, maxWidth: 360 }}>
          <BCTypography variant="body4" component="p" sx={{ fontWeight: 700 }}>
            {t('initiativeAgreement:actionDetail.recommendedCredits')}
          </BCTypography>
          <TextField
            size="small"
            fullWidth
            type="number"
            value={credits}
            inputProps={{
              min: 0,
              max: creditAllocation ?? undefined,
              'data-test': 'recommended-credits-input',
              'aria-label': t(
                'initiativeAgreement:actionDetail.recommendedCredits'
              )
            }}
            onChange={(event) => setCredits(event.target.value)}
            onBlur={() => {
              const next = credits === '' ? null : Number(credits)
              if (next !== (recommendedCredits ?? null)) {
                saveCredits(next)
              }
            }}
          />
        </Box>
      )}

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
          <BCButton
            key={button.action}
            type="button"
            variant={button.variant}
            color={button.colour}
            size="small"
            disabled={isPending || blockedByEvidence(button.action)}
            data-test={`workflow-${button.action}`}
            onClick={() => start(button.action)}
          >
            {t(`initiativeAgreement:workflow.${button.labelKey}`)}
          </BCButton>
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
                {t('initiativeAgreement:workflow.commentPrompt')}
              </BCTypography>
              <TextField
                multiline
                minRows={4}
                fullWidth
                autoFocus
                value={comment}
                inputProps={{
                  'data-test': 'workflow-comment',
                  'aria-label': t('initiativeAgreement:workflow.commentPrompt')
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
