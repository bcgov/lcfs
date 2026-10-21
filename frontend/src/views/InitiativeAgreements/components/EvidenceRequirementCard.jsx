import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { evidencePlainText } from './evidenceRichText'
import { EvidenceRichTextField } from './EvidenceRichTextField'
import {
  OUTCOME_SATISFACTORY,
  OUTCOME_INFORMATION_REQUESTED
} from './evidenceConstants'

const requirementHeading = (requirement) =>
  requirement.title || evidencePlainText(requirement.description)

const OUTSTANDING_COLOUR = 'secondary.main'

const railColour = (outcome) => {
  if (outcome === OUTCOME_SATISFACTORY) return 'success.main'
  if (outcome === OUTCOME_INFORMATION_REQUESTED) return OUTSTANDING_COLOUR
  return 'divider'
}

const backgroundColour = (outcome) => {
  if (outcome === OUTCOME_SATISFACTORY) return '#f4faf5'
  if (outcome === OUTCOME_INFORMATION_REQUESTED) return '#fff8e7'
  return '#f5f5f5'
}

const TOGGLE_BUTTON_SX = {
  position: 'absolute',
  top: '50%',
  right: 14,
  transform: 'translateY(-50%)',
  '&.Mui-focusVisible': {
    outline: '2px solid',
    outlineColor: 'primary.main',
    outlineOffset: '2px'
  }
}

const chevronSx = (expanded) => ({
  width: '2rem',
  height: '2rem',
  transform: expanded ? 'rotate(180deg)' : 'none',
  transition: 'transform 150ms ease-in-out'
})

export const EvidenceRequirementCard = ({
  designatedActionId,
  requirement,
  onSave,
  onRemove,
  canEdit,
  missingInformationReadOnly,
  actions,
  allRequestsComplete,
  expanded,
  setExpanded
}) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [justSaved, setJustSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [outcome, setOutcome] = useState(requirement.reviewOutcome)
  useEffect(() => {
    setOutcome(requirement.reviewOutcome)
  }, [requirement.reviewOutcome])
  const save = (payload, callbacks) => {
    setSaveError('')
    onSave(payload, {
      onSuccess: () => {
        setJustSaved(true)
        setTimeout(() => setJustSaved(false), 1800)
        callbacks?.onSuccess?.()
      },
      onError: (err) => {
        if (callbacks?.onError) callbacks.onError(err)
        else {
          setOutcome(requirement.reviewOutcome)
          setSaveError(
            err?.response?.data?.detail ||
              err?.message ||
              t('initiativeAgreement:workflow.actionFailed')
          )
        }
      }
    })
  }
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const heading = requirementHeading(requirement)

  const commitOutcome = (next) => {
    setOutcome(next === outcome ? null : next)
    save(
      next === outcome ? { clearReviewOutcome: true } : { reviewOutcome: next }
    )
  }

  const locked =
    outcome === OUTCOME_SATISFACTORY ||
    outcome === OUTCOME_INFORMATION_REQUESTED
      ? outcome
      : null

  const fieldProps = (key, testKey, labelKey) => ({
    designatedActionId,
    canEdit,
    locked,
    label: t(`initiativeAgreement:evidence.${labelKey}`),
    testId: `eoc-${testKey}-${requirement.evidenceRequirementId}`,
    field: {
      value: requirement[key],
      onSave: (value, callbacks) =>
        save({ [key]: key === 'description' ? value.trim() : value }, callbacks)
    }
  })

  const expandFromOutcome = () => setExpanded(true)
  const outcomeControl = (value, testId, label) => (
    <FormControlLabel
      sx={{ m: 0, whiteSpace: 'nowrap' }}
      onClick={(event) => {
        event.stopPropagation()
        expandFromOutcome()
      }}
      control={
        <Checkbox
          size="small"
          disabled={!canEdit}
          checked={outcome === value}
          data-test={testId}
          onChange={() => commitOutcome(value)}
        />
      }
      label={<BCTypography variant="body4">{label}</BCTypography>}
    />
  )

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      data-test={`eoc-card-${requirement.evidenceRequirementId}`}
      data-review-state={
        outcome === OUTCOME_SATISFACTORY
          ? 'satisfactory'
          : outcome === OUTCOME_INFORMATION_REQUESTED
            ? 'information-requested'
            : 'unreviewed'
      }
      sx={{
        border: 1,
        borderColor: 'divider',
        borderLeft: 14,
        borderLeftColor: railColour(outcome),
        bgcolor: 'background.paper',
        '&:before': { display: 'none' },
        '&.Mui-expanded': { m: 0 }
      }}
    >
      <Box
        component="span"
        role="group"
        aria-label={`${requirement.requirementNumber}. ${heading}`}
        aria-controls={`eoc-details-${requirement.evidenceRequirementId}`}
        id={`eoc-header-${requirement.evidenceRequirementId}`}
        onClick={() => setExpanded(!expanded)}
        sx={{
          position: 'relative',
          display: 'block',
          bgcolor: backgroundColour(outcome),
          cursor: 'pointer'
        }}
      >
        <Box
          component="span"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            minHeight: 82,
            pl: 2,
            pr: '4rem',
            py: 1
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              minWidth: { xs: 190, md: 220 }
            }}
          >
            {outcomeControl(
              OUTCOME_SATISFACTORY,
              `eoc-satisfactory-${requirement.evidenceRequirementId}`,
              t('initiativeAgreement:evidence.satisfactory')
            )}
            {outcomeControl(
              OUTCOME_INFORMATION_REQUESTED,
              `eoc-request-${requirement.evidenceRequirementId}`,
              t('initiativeAgreement:evidence.requestInformation')
            )}
          </Box>
          <BCTypography
            variant="body4"
            component="p"
            sx={{ fontWeight: 700, color: 'primary.main', m: 0, flexGrow: 1 }}
            data-test={`eoc-heading-${requirement.evidenceRequirementId}`}
          >
            {requirement.requirementNumber}. {heading}
          </BCTypography>
          {justSaved && (
            <BCBox
              component="span"
              data-test={`eoc-saved-${requirement.evidenceRequirementId}`}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.3,
                color: 'success.main',
                fontSize: '0.8rem',
                whiteSpace: 'nowrap'
              }}
            >
              <CheckIcon fontSize="inherit" />
              {t('initiativeAgreement:evidence.saved')}
            </BCBox>
          )}
        </Box>
        <IconButton
          color="primary"
          className="small-icon"
          data-test={`eoc-summary-${requirement.evidenceRequirementId}`}
          aria-label={`${requirement.requirementNumber}. ${heading}`}
          aria-controls={`eoc-details-${requirement.evidenceRequirementId}`}
          aria-expanded={expanded}
          sx={TOGGLE_BUTTON_SX}
          onClick={(event) => {
            event.stopPropagation()
            setExpanded(!expanded)
          }}
        >
          <ExpandMoreIcon aria-hidden="true" sx={chevronSx(expanded)} />
        </IconButton>
      </Box>

      <AccordionDetails
        id={`eoc-details-${requirement.evidenceRequirementId}`}
        sx={{ px: 2, pt: 1, pb: 2 }}
      >
        <BCBox sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {saveError && (
            <BCAlert severity="error" dismissible={false}>
              {saveError}
            </BCAlert>
          )}
          {canEdit && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Tooltip
                title={t('initiativeAgreement:evidence.removeRequirement')}
              >
                <IconButton
                  size="small"
                  data-test={`eoc-remove-${requirement.evidenceRequirementId}`}
                  aria-label={t(
                    'initiativeAgreement:evidence.removeRequirement'
                  )}
                  onClick={() => setConfirmingRemove(true)}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          {outcome === OUTCOME_INFORMATION_REQUESTED && (
            <>
              <EvidenceRichTextField
                {...fieldProps(
                  'missingInformation',
                  'missing-information',
                  'missingInformation'
                )}
                placeholder={t(
                  'initiativeAgreement:evidence.missingInformationPlaceholder'
                )}
                canEdit={!missingInformationReadOnly}
              />
              {actions}
              {!allRequestsComplete && (
                <BCTypography
                  variant="body4"
                  color="text.secondary"
                  data-test="eoc-incomplete-request"
                >
                  {t('initiativeAgreement:evidence.completeAllRequests')}
                </BCTypography>
              )}
            </>
          )}

          <EvidenceRichTextField
            {...fieldProps('reviewNotes', 'notes', 'notesLabel')}
            allowPencil={false}
          />
          <EvidenceRichTextField
            {...fieldProps('description', 'description', 'evidenceSummary')}
            allowPencil={false}
            required
          />
          <EvidenceRichTextField
            {...fieldProps('analystReview', 'review', 'evaluationLabel')}
            placeholder={t('initiativeAgreement:evidence.evidencePlaceholder')}
          />
        </BCBox>
      </AccordionDetails>

      <BCModal
        open={confirmingRemove}
        onClose={() => setConfirmingRemove(false)}
        data={{
          title: t('initiativeAgreement:evidence.confirmRemoveTitle'),
          primaryButtonText: t('initiativeAgreement:evidence.confirmRemove'),
          primaryButtonColor: 'error',
          primaryButtonAction: () => {
            setConfirmingRemove(false)
            onRemove()
          },
          secondaryButtonText: t('common:cancelBtn'),
          content: (
            <BCTypography
              variant="body4"
              component="p"
              data-test={`eoc-remove-confirm-${requirement.evidenceRequirementId}`}
            >
              {t('initiativeAgreement:evidence.confirmRemoveBody', {
                name: heading
              })}
            </BCTypography>
          )
        }}
      />
    </Accordion>
  )
}
