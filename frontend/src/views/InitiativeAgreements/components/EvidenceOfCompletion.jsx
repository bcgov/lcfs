import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Checkbox,
  Collapse,
  FormControlLabel,
  IconButton,
  Paper,
  SvgIcon,
  TextField,
  Tooltip
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/Close'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
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
export const requirementHeading = (requirement) =>
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

// A gold disc is too pale against white to carry meaning on its own
// (WCAG 1.4.11), so the exclamation mark is dark rather than the
// wireframe's white; the shape stays legible at any contrast setting.
const OutstandingIcon = ({ titleAccess, sx }) => (
  <SvgIcon titleAccess={titleAccess} sx={sx}>
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <path d="M13 17h-2v-2h2zm0-4h-2V7h2z" fill="#313132" />
  </SvgIcon>
)

// The text of a requirement — title, description and evaluation — is
// edited deliberately: Edit opens the fields, Save writes them, Cancel
// puts back what was there. Testing found save-as-you-type unclear;
// nobody could tell whether a half-finished evaluation had been kept.
// The outcome boxes and notes are decisions, not prose, and still take
// effect at once.
const RequirementCard = ({
  requirement,
  onSave,
  onRemove,
  canEdit,
  // Edit mode exists (#5079) but its entry point is hidden for now: a
  // pencil beside the remove icon read as two unlabelled controls, and
  // the × as "cancel". Flip this on once the control is redesigned.
  allowEdit = false
}) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [justSaved, setJustSaved] = useState(false)
  const acknowledge = () => {
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1800)
  }

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(requirement.title || '')
  const [description, setDescription] = useState(requirement.description)
  const [evaluation, setEvaluation] = useState(requirement.analystReview || '')
  const [reviewNotes, setReviewNotes] = useState(requirement.reviewNotes || '')
  const [notesShown, setNotesShown] = useState(!!requirement.reviewNotes)

  // A refetch after someone else's save must not overwrite an edit in
  // progress; outside edit mode the card mirrors the record.
  useEffect(() => {
    if (!editing) {
      setTitle(requirement.title || '')
      setDescription(requirement.description)
      setEvaluation(requirement.analystReview || '')
    }
  }, [
    editing,
    requirement.title,
    requirement.description,
    requirement.analystReview
  ])

  const outcome = requirement.reviewOutcome
  const heading = requirementHeading(requirement)

  // Clicking the box that is already ticked returns the requirement to
  // unreviewed, which is how an analyst undoes a decision.
  const setOutcome = (next) => {
    onSave(
      next === outcome ? { clearReviewOutcome: true } : { reviewOutcome: next }
    )
    acknowledge()
  }

  const startEditing = () => {
    setTitle(requirement.title || '')
    setDescription(requirement.description)
    setEvaluation(requirement.analystReview || '')
    setEditing(true)
  }

  const cancelEditing = () => setEditing(false)

  const canSave = description.trim().length > 0 && title.trim().length > 0

  const saveEdits = () => {
    if (!canSave) return
    const payload = {}
    if (title.trim() !== (requirement.title || '')) payload.title = title.trim()
    if (description.trim() !== requirement.description) {
      payload.description = description.trim()
    }
    if (evaluation !== (requirement.analystReview || '')) {
      payload.analystReview = evaluation
    }
    if (Object.keys(payload).length) {
      onSave(payload)
      acknowledge()
    }
    setEditing(false)
  }

  const textFieldProps = (testId, label) => ({
    fullWidth: true,
    size: 'small',
    multiline: true,
    minRows: 2,
    // Read-only, not disabled: disabled text is dimmed below AA contrast
    // and is skipped by screen readers.
    InputProps: { readOnly: !editing },
    inputProps: { 'data-test': testId, 'aria-label': label }
  })

  return (
    <Paper
      variant="outlined"
      data-test={`eoc-card-${requirement.evidenceRequirementId}`}
      sx={{
        p: 2,
        borderLeft: 4,
        borderLeftColor: railColour(outcome),
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <BCBox sx={{ flexGrow: 1 }}>
          {editing ? (
            <TextField
              fullWidth
              size="small"
              autoFocus
              value={title}
              inputProps={{
                'data-test': `eoc-title-${requirement.evidenceRequirementId}`,
                'aria-label': t('initiativeAgreement:evidence.titleLabel')
              }}
              onChange={(event) => setTitle(event.target.value)}
            />
          ) : (
            <BCTypography
              variant="body4"
              component="p"
              sx={{ fontWeight: 700, m: 0 }}
              data-test={`eoc-heading-${requirement.evidenceRequirementId}`}
            >
              {requirement.requirementNumber}. {heading}
            </BCTypography>
          )}
        </BCBox>
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
        {canEdit && allowEdit && !editing && (
          <IconButton
            size="small"
            data-test={`eoc-edit-${requirement.evidenceRequirementId}`}
            aria-label={t('initiativeAgreement:evidence.editRequirement', {
              name: heading
            })}
            onClick={startEditing}
          >
            <EditOutlinedIcon fontSize="inherit" />
          </IconButton>
        )}
        {canEdit && (
          <Tooltip title={t('initiativeAgreement:evidence.removeRequirement')}>
            <IconButton
              size="small"
              data-test={`eoc-remove-${requirement.evidenceRequirementId}`}
              aria-label={t('initiativeAgreement:evidence.removeRequirement')}
              onClick={onRemove}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flexDirection: { xs: 'column', md: 'row' }
        }}
      >
        <BCBox
          sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          <TextField
            {...textFieldProps(
              `eoc-description-${requirement.evidenceRequirementId}`,
              t('initiativeAgreement:evidence.descriptionFor', {
                name: heading
              })
            )}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          {notesShown && (
            <>
              <BCTypography variant="body4" sx={{ fontWeight: 700 }}>
                {t('initiativeAgreement:evidence.notesLabel')}
              </BCTypography>
              <TextField
                multiline
                minRows={2}
                fullWidth
                size="small"
                disabled={!canEdit}
                value={reviewNotes}
                inputProps={{
                  'data-test': `eoc-notes-${requirement.evidenceRequirementId}`,
                  'aria-label': t('initiativeAgreement:evidence.notesFor', {
                    name: heading
                  })
                }}
                onChange={(event) => setReviewNotes(event.target.value)}
                onBlur={() => {
                  if (reviewNotes !== (requirement.reviewNotes || '')) {
                    onSave({ reviewNotes })
                    acknowledge()
                  }
                }}
              />
            </>
          )}
          <BCTypography variant="body4" sx={{ fontWeight: 700 }}>
            {t('initiativeAgreement:evidence.evaluationLabel')}
          </BCTypography>
          <TextField
            {...textFieldProps(
              `eoc-review-${requirement.evidenceRequirementId}`,
              t('initiativeAgreement:evidence.evaluationFor', { name: heading })
            )}
            value={evaluation}
            placeholder={
              editing
                ? t('initiativeAgreement:evidence.evidencePlaceholder')
                : ''
            }
            onChange={(event) => setEvaluation(event.target.value)}
          />
          {editing && (
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <BCButton
                type="button"
                variant="outlined"
                color="primary"
                size="small"
                data-test={`eoc-cancel-${requirement.evidenceRequirementId}`}
                onClick={cancelEditing}
              >
                {t('common:cancelBtn')}
              </BCButton>
              <BCButton
                type="button"
                variant="contained"
                color="primary"
                size="small"
                data-test={`eoc-save-${requirement.evidenceRequirementId}`}
                disabled={!canSave}
                onClick={saveEdits}
              >
                {t('common:saveBtn')}
              </BCButton>
            </Box>
          )}
        </BCBox>

        <BCBox
          sx={{
            minWidth: 220,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start'
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                disabled={!canEdit}
                checked={outcome === OUTCOME_SATISFACTORY}
                data-test={`eoc-satisfactory-${requirement.evidenceRequirementId}`}
                onChange={() => setOutcome(OUTCOME_SATISFACTORY)}
              />
            }
            label={
              <BCTypography variant="body4">
                {t('initiativeAgreement:evidence.satisfactory')}
              </BCTypography>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                disabled={!canEdit}
                checked={outcome === OUTCOME_INFORMATION_REQUESTED}
                data-test={`eoc-request-${requirement.evidenceRequirementId}`}
                onChange={() => setOutcome(OUTCOME_INFORMATION_REQUESTED)}
              />
            }
            label={
              <BCTypography variant="body4">
                {t('initiativeAgreement:evidence.requestInformation')}
              </BCTypography>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                disabled={!canEdit}
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
        </BCBox>
      </Box>
    </Paper>
  )
}

// Compact and wide (#5118): tight rows and small icons, half the row on
// wider screens, and titles free to wrap rather than setting its width.
const ReviewSummary = ({ requirements }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: 1,
        flex: { xs: '1 1 100%', md: '0 1 50%' },
        minWidth: 0
      }}
      data-test="eoc-review-summary"
    >
      <BCTypography
        variant="body4"
        component="p"
        color="primary"
        sx={{ fontWeight: 700, m: 0, mb: 0.5 }}
      >
        {t('initiativeAgreement:evidence.reviewSummary')}
      </BCTypography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {requirements.map((requirement) => (
          <Box
            key={requirement.evidenceRequirementId}
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}
          >
            {/* Two states, as the wireframe has it: satisfied, or still
                outstanding. The icon carries the outcome, so it needs
                words — colour and shape alone are not an accessible
                name — and the words still say which kind of outstanding. */}
            {requirement.reviewOutcome === OUTCOME_SATISFACTORY ? (
              <CheckCircleIcon
                color="success"
                sx={{ fontSize: 16, mt: '2px', flexShrink: 0 }}
                titleAccess={t('initiativeAgreement:evidence.satisfactory')}
              />
            ) : (
              <OutstandingIcon
                sx={{
                  fontSize: 16,
                  mt: '2px',
                  flexShrink: 0,
                  color: OUTSTANDING_COLOUR
                }}
                titleAccess={
                  requirement.reviewOutcome === OUTCOME_INFORMATION_REQUESTED
                    ? t('initiativeAgreement:evidence.requestInformation')
                    : t('initiativeAgreement:evidence.pending')
                }
              />
            )}
            <BCTypography
              variant="body4"
              sx={{ minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.5 }}
            >
              {requirementHeading(requirement)}
            </BCTypography>
          </Box>
        ))}
      </Box>
    </Paper>
  )
}

// What the analyst needs from the proponent (#5118). Always on the page,
// not only inside the request dialog, so the current ask is visible
// between rounds; Request additional information sends it.
const MissingInformation = ({ value, onChange, onBlur, readOnly }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const label = t('initiativeAgreement:evidence.missingInformation')
  return (
    <Paper
      variant="outlined"
      data-test="eoc-missing-information"
      sx={{
        p: 1.5,
        borderLeft: 4,
        borderLeftColor: 'success.main',
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}
    >
      <BCTypography
        variant="body4"
        component="label"
        htmlFor="eoc-missing-information-input"
        color="primary"
        sx={{ fontWeight: 700 }}
      >
        {label}
      </BCTypography>
      <TextField
        id="eoc-missing-information-input"
        multiline
        minRows={2}
        fullWidth
        size="small"
        value={value}
        placeholder={
          readOnly
            ? ''
            : t('initiativeAgreement:evidence.missingInformationPlaceholder')
        }
        // Read-only, not disabled, for the same contrast reason as the
        // requirement fields.
        InputProps={{ readOnly }}
        inputProps={{ 'data-test': 'eoc-missing-information-input' }}
        onChange={(event) => onChange?.(event.target.value)}
        onBlur={onBlur}
      />
    </Paper>
  )
}

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
  allowEdit = false,
  // The evidence decisions — accept, request information — rendered
  // beneath the review summary they act on (#5080). The page owns them;
  // this section only says where they go.
  actions = null,
  // The Missing information box (#5118). The page owns its text because
  // the request button sends it.
  missingInformation = '',
  onMissingInformationChange,
  onMissingInformationBlur,
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

  return (
    // A box of its own inside the designated action card (#5118): the
    // evidence review, its summary and its decisions read as one unit,
    // with the recommendation beneath it.
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {requirements.map((requirement) => (
              <RequirementCard
                key={requirement.evidenceRequirementId}
                requirement={requirement}
                canEdit={canEdit}
                allowEdit={allowEdit}
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

            <MissingInformation
              value={missingInformation}
              onChange={onMissingInformationChange}
              onBlur={onMissingInformationBlur}
              readOnly={missingInformationReadOnly}
            />

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 2,
                flexWrap: 'wrap'
              }}
            >
              {requirements.length > 0 && (
                <ReviewSummary requirements={requirements} />
              )}
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
