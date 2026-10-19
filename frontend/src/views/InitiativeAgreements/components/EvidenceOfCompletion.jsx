import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Collapse from '@mui/material/Collapse'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import {
  useCreateEvidenceRequirement,
  useDeleteEvidenceRequirement,
  useEvidenceRequirements,
  useUpdateEvidenceRequirement
} from '@/hooks/useInitiativeAgreements'
import ModalField from './ModalField'

// Evidence of completion review for a designated action (#4899, #5079).
// Each requirement carries a title, the description of what is required,
// the analyst's evaluation, optional notes, and one outcome. The two
// outcome boxes are mutually exclusive — a requirement is either
// satisfactory or waiting on information, never both.
export const OUTCOME_SATISFACTORY = 'Satisfactory'
export const OUTCOME_INFORMATION_REQUESTED = 'Information requested'

// Requirements from before titles existed carry none; their description
// is the heading until one is saved.
const requirementHeading = (requirement) =>
  requirement.title || requirement.description

// The wireframe's EOC colours (#5118): green when satisfactory, BC gold
// while information is outstanding. Gold replaces the theme's orange
// warning, which the design does not use here.
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

// Long entries grow the box with the text up to 1000px, then scroll
// inside it (#5118). The autosizing textarea sets overflow inline, so
// the scroll needs !important to win.
const GROWING_TEXT_SX = {
  '& textarea': { maxHeight: 1000, overflowY: 'auto !important' }
}

// A text field that saves itself when the user leaves it (#5118), the
// way these fields worked before #5079's edit mode. A refetch while the
// user is typing (after an outcome box saves, say) must not overwrite
// what they have typed, so the saved value only flows in while the
// field is not focused.
const useAutosaveField = (savedValue, onCommit) => {
  const [value, setValue] = useState(savedValue ?? '')
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setValue(savedValue ?? '')
  }, [savedValue])
  return {
    value,
    onChange: (event) => setValue(event.target.value),
    onFocus: () => {
      focused.current = true
    },
    onBlur: () => {
      focused.current = false
      if (value === (savedValue ?? '')) return
      // onCommit may refuse the value (a blanked description) and hand
      // back what to show instead.
      const replacement = onCommit(value)
      if (replacement !== undefined) setValue(replacement)
    }
  }
}

// Each requirement's description, evaluation and notes save as the user
// leaves them, with a brief "Saved" so the save is visible; the outcome
// boxes take effect at once. The title is set when the requirement is
// added. Removing asks first: the requirement leaves the list and there
// is no way back from this page.
const RequirementCard = ({
  requirement,
  onSave,
  onRemove,
  canEdit,
  missingInformationReadOnly,
  actions,
  allRequestsComplete
}) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [justSaved, setJustSaved] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [outcome, setOutcome] = useState(requirement.reviewOutcome)
  useEffect(() => {
    setOutcome(requirement.reviewOutcome)
  }, [requirement.reviewOutcome])
  const save = (payload) => {
    onSave(payload)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1800)
  }
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [notesShown, setNotesShown] = useState(!!requirement.reviewNotes)

  const description = useAutosaveField(requirement.description, (next) => {
    // A requirement must say what evidence it needs; a blanked
    // description is put back rather than saved.
    if (!next.trim()) return requirement.description
    save({ description: next.trim() })
  })
  const evaluation = useAutosaveField(requirement.analystReview, (next) => {
    save({ analystReview: next })
  })
  const notes = useAutosaveField(requirement.reviewNotes, (next) => {
    save({ reviewNotes: next })
  })
  const missingInformation = useAutosaveField(
    requirement.missingInformation,
    (next) => save({ missingInformation: next })
  )

  const heading = requirementHeading(requirement)

  // Clicking the box that is already ticked returns the requirement to
  // unreviewed, which is how an analyst undoes a decision.
  const commitOutcome = (next) => {
    setOutcome(next === outcome ? null : next)
    save(
      next === outcome ? { clearReviewOutcome: true } : { reviewOutcome: next }
    )
  }

  const textFieldProps = (testId, label) => ({
    fullWidth: true,
    size: 'small',
    multiline: true,
    minRows: 2,
    sx: GROWING_TEXT_SX,
    // Read-only, not disabled: disabled text is dimmed below AA contrast
    // and is skipped by screen readers.
    InputProps: { readOnly: !canEdit },
    inputProps: { 'data-test': testId, 'aria-label': label }
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
        borderLeft: 6,
        borderLeftColor: railColour(outcome),
        bgcolor: backgroundColour(outcome),
        '&:before': { display: 'none' },
        '&.Mui-expanded': { m: 0 }
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        data-test={`eoc-summary-${requirement.evidenceRequirementId}`}
        aria-controls={`eoc-details-${requirement.evidenceRequirementId}`}
        id={`eoc-summary-${requirement.evidenceRequirementId}`}
        sx={{
          px: 2,
          minHeight: 82,
          '& .MuiAccordionSummary-content': {
            alignItems: 'center',
            gap: 3,
            my: 1
          },
          '& .MuiAccordionSummary-content.Mui-expanded': { my: 1 }
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
      </AccordionSummary>

      <AccordionDetails
        id={`eoc-details-${requirement.evidenceRequirementId}`}
        sx={{ px: 2, pt: 1, pb: 2 }}
      >
        <BCBox sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
              <MissingInformation
                field={missingInformation}
                label={t('initiativeAgreement:evidence.missingInformation')}
                placeholder={t(
                  'initiativeAgreement:evidence.missingInformationPlaceholder'
                )}
                readOnly={missingInformationReadOnly}
                testId={`eoc-missing-information-${requirement.evidenceRequirementId}`}
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

          {notesShown && (
            <BCBox sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <BCTypography variant="body4" sx={{ fontWeight: 700 }}>
                {t('initiativeAgreement:evidence.notesLabel')}
              </BCTypography>
              <TextField
                {...textFieldProps(
                  `eoc-notes-${requirement.evidenceRequirementId}`,
                  t('initiativeAgreement:evidence.notesFor', { name: heading })
                )}
                {...notes}
              />
            </BCBox>
          )}
          <FormControlLabel
            sx={{ alignSelf: 'flex-start', m: 0 }}
            control={
              <Checkbox
                size="small"
                checked={notesShown}
                data-test={`eoc-notes-toggle-${requirement.evidenceRequirementId}`}
                onChange={(event) => setNotesShown(event.target.checked)}
              />
            }
            label={
              <BCTypography variant="body4">
                {t('initiativeAgreement:evidence.notesLabel')}
              </BCTypography>
            }
          />
          <BCBox sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <BCTypography variant="body4" sx={{ fontWeight: 700 }}>
              {t('initiativeAgreement:evidence.evidenceSummary')}
            </BCTypography>
            <TextField
              {...textFieldProps(
                `eoc-description-${requirement.evidenceRequirementId}`,
                t('initiativeAgreement:evidence.descriptionFor', {
                  name: heading
                })
              )}
              {...description}
            />
          </BCBox>
          <BCBox sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <BCTypography variant="body4" sx={{ fontWeight: 700 }}>
              {t('initiativeAgreement:evidence.evaluationLabel')}
            </BCTypography>
            <TextField
              {...textFieldProps(
                `eoc-review-${requirement.evidenceRequirementId}`,
                t('initiativeAgreement:evidence.evaluationFor', {
                  name: heading
                })
              )}
              placeholder={
                canEdit
                  ? t('initiativeAgreement:evidence.evidencePlaceholder')
                  : ''
              }
              {...evaluation}
            />
          </BCBox>
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

const MissingInformation = ({
  field,
  label,
  placeholder,
  readOnly,
  testId
}) => (
  <BCBox sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
    <BCTypography
      variant="body4"
      component="label"
      htmlFor={testId}
      color="primary"
      sx={{ fontWeight: 700 }}
    >
      {label}
    </BCTypography>
    <TextField
      id={testId}
      multiline
      minRows={2}
      fullWidth
      size="small"
      sx={GROWING_TEXT_SX}
      placeholder={readOnly ? '' : placeholder}
      InputProps={{ readOnly }}
      inputProps={{ 'data-test': testId }}
      {...field}
    />
  </BCBox>
)

// Adding a requirement: a title and the description of what is required,
// in a modal, created only on confirm.
const AddRequirementModal = ({ open, onClose, onCreate, isPending }) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const close = () => {
    setTitle('')
    setDescription('')
    onClose()
  }
  const canCreate = title.trim().length > 0 && description.trim().length > 0
  const submit = () => {
    if (!canCreate) return
    onCreate({ title: title.trim(), description: description.trim() })
    close()
  }

  return (
    <BCModal
      open={open}
      onClose={close}
      data={{
        title: t('initiativeAgreement:evidence.addTitle'),
        primaryButtonText: t('initiativeAgreement:evidence.createRequirement'),
        primaryButtonAction: submit,
        primaryButtonDisabled: !canCreate || isPending,
        secondaryButtonText: t('common:cancelBtn'),
        content: (
          <Box
            sx={{
              minWidth: { xs: 'auto', sm: 460 },
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              pt: 1
            }}
          >
            <ModalField
              id="eoc-new-title"
              label={t('initiativeAgreement:evidence.titleLabel')}
              value={title}
              autoFocus
              inputProps={{ 'data-test': 'eoc-new-title' }}
              onChange={(event) => setTitle(event.target.value)}
            />
            <ModalField
              id="eoc-new-description"
              label={t('initiativeAgreement:evidence.descriptionLabel')}
              value={description}
              multiline
              minRows={3}
              inputProps={{ 'data-test': 'eoc-new-description' }}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Box>
        )
      }}
    />
  )
}

export const EvidenceOfCompletion = ({
  designatedActionId,
  canEdit = true,
  // Accept is a designated-action decision; request-information buttons
  // are rendered in the matching EOC accordion.
  actions = null,
  renderRequestAction = null,
  missingInformationReadOnly = false
}) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [expanded, setExpanded] = useState(true)
  const [adding, setAdding] = useState(false)

  const { data: requirements = [], isLoading } =
    useEvidenceRequirements(designatedActionId)
  const { mutate: createRequirement, isPending: isCreating } =
    useCreateEvidenceRequirement(designatedActionId)
  const { mutate: updateRequirement } =
    useUpdateEvidenceRequirement(designatedActionId)
  const { mutate: removeRequirement } =
    useDeleteEvidenceRequirement(designatedActionId)
  const requestedRequirements = requirements.filter(
    (requirement) => requirement.reviewOutcome === OUTCOME_INFORMATION_REQUESTED
  )
  const allRequestsComplete =
    requestedRequirements.length > 0 &&
    requestedRequirements.every((requirement) =>
      (requirement.missingInformation ?? '').trim()
    )

  return (
    // A box of its own inside the designated action card (#5118).
    <Paper
      variant="outlined"
      sx={{ mt: 3, p: 2, borderRadius: 1 }}
      data-test="evidence-of-completion-section"
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          pb: 1,
          mb: 2
        }}
      >
        <BCTypography variant="h6" color="primary">
          {t('initiativeAgreement:evidence.sectionTitle')}
        </BCTypography>
        <IconButton
          size="small"
          data-test="eoc-toggle"
          aria-label={t('initiativeAgreement:evidence.sectionTitle')}
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        {isLoading ? (
          <Loading message={t('initiativeAgreement:evidence.loading')} />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {requirements.map((requirement) => (
              <RequirementCard
                key={requirement.evidenceRequirementId}
                requirement={requirement}
                canEdit={canEdit}
                missingInformationReadOnly={missingInformationReadOnly}
                actions={renderRequestAction?.(
                  requirement,
                  allRequestsComplete
                )}
                allRequestsComplete={allRequestsComplete}
                onSave={(payload) =>
                  updateRequirement({
                    evidenceRequirementId: requirement.evidenceRequirementId,
                    ...payload
                  })
                }
                onRemove={() =>
                  removeRequirement(requirement.evidenceRequirementId)
                }
              />
            ))}

            {!requirements.length && (
              <BCTypography variant="body4" color="text.secondary">
                {t('initiativeAgreement:evidence.empty')}
              </BCTypography>
            )}

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end'
              }}
            >
              <Role roles={[roles.ia_analyst, roles.ia_manager]}>
                <BCButton
                  type="button"
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon />}
                  data-test="eoc-add-button"
                  onClick={() => setAdding(true)}
                >
                  {t('initiativeAgreement:evidence.addEoc')}
                </BCButton>
              </Role>
            </Box>

            {actions && <Box data-test="eoc-review-actions">{actions}</Box>}
          </Box>
        )}
      </Collapse>

      <AddRequirementModal
        open={adding}
        isPending={isCreating}
        onClose={() => setAdding(false)}
        onCreate={createRequirement}
      />
    </Paper>
  )
}

export default EvidenceOfCompletion
