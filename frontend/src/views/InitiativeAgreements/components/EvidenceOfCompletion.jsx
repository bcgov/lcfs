import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Checkbox,
  Collapse,
  FormControlLabel,
  IconButton,
  Paper,
  TextField
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/Close'
import ErrorIcon from '@mui/icons-material/Error'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
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

// Evidence of completion review for a designated action (#4899). Each
// requirement carries the analyst's narrative, optional notes, and one
// outcome. The two outcome boxes are mutually exclusive — a requirement is
// either satisfactory or waiting on information, never both.
export const OUTCOME_SATISFACTORY = 'Satisfactory'
export const OUTCOME_INFORMATION_REQUESTED = 'Information requested'

const railColour = (outcome) => {
  if (outcome === OUTCOME_SATISFACTORY) return 'success.main'
  if (outcome === OUTCOME_INFORMATION_REQUESTED) return 'warning.main'
  return 'divider'
}

const RequirementCard = ({ requirement, onSave, onRemove, canEdit }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  // Everything here saves as you go. Without a visible acknowledgement
  // that is indistinguishable from nothing happening, so each save shows
  // one briefly.
  const [justSaved, setJustSaved] = useState(false)
  const save = (payload) => {
    onSave(payload)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1800)
  }
  const [analystReview, setAnalystReview] = useState(
    requirement.analystReview || ''
  )
  const [reviewNotes, setReviewNotes] = useState(requirement.reviewNotes || '')
  const [notesShown, setNotesShown] = useState(!!requirement.reviewNotes)

  const outcome = requirement.reviewOutcome

  // Clicking the box that is already ticked returns the requirement to
  // unreviewed, which is how an analyst undoes a decision.
  const setOutcome = (next) => {
    if (next === outcome) {
      save({ clearReviewOutcome: true })
    } else {
      save({ reviewOutcome: next })
    }
  }

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
          <BCTypography variant="body4" component="p" sx={{ fontWeight: 700 }}>
            {requirement.description}
          </BCTypography>
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
        {canEdit && (
          <IconButton
            size="small"
            data-test={`eoc-remove-${requirement.evidenceRequirementId}`}
            aria-label={t('initiativeAgreement:evidence.removeRequirement')}
            onClick={onRemove}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
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
            multiline
            minRows={2}
            fullWidth
            size="small"
            disabled={!canEdit}
            value={analystReview}
            placeholder={t('initiativeAgreement:evidence.evidencePlaceholder')}
            inputProps={{
              'data-test': `eoc-review-${requirement.evidenceRequirementId}`,
              // A placeholder is not a label: it disappears on input and
              // is not reliably announced.
              'aria-label': t('initiativeAgreement:evidence.evidenceFor', {
                name: requirement.description
              })
            }}
            onChange={(event) => setAnalystReview(event.target.value)}
            onBlur={() => {
              if (analystReview !== (requirement.analystReview || '')) {
                save({ analystReview })
              }
            }}
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
                    name: requirement.description
                  })
                }}
                onChange={(event) => setReviewNotes(event.target.value)}
                onBlur={() => {
                  if (reviewNotes !== (requirement.reviewNotes || '')) {
                    save({ reviewNotes })
                  }
                }}
              />
            </>
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

const ReviewSummary = ({ requirements }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, maxWidth: 520 }}
      data-test="eoc-review-summary"
    >
      <BCTypography variant="h6" color="primary" mb={1}>
        {t('initiativeAgreement:evidence.reviewSummary')}
      </BCTypography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {requirements.map((requirement) => (
          <Box
            key={requirement.evidenceRequirementId}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            {/* The icon carries the outcome, so it needs words: colour
                and shape alone are not an accessible name. */}
            {requirement.reviewOutcome === OUTCOME_SATISFACTORY ? (
              <CheckCircleIcon
                fontSize="small"
                color="success"
                titleAccess={t('initiativeAgreement:evidence.satisfactory')}
              />
            ) : (
              <ErrorIcon
                fontSize="small"
                color={
                  requirement.reviewOutcome === OUTCOME_INFORMATION_REQUESTED
                    ? 'warning'
                    : 'disabled'
                }
                titleAccess={
                  requirement.reviewOutcome === OUTCOME_INFORMATION_REQUESTED
                    ? t('initiativeAgreement:evidence.requestInformation')
                    : t('initiativeAgreement:evidence.pending')
                }
              />
            )}
            <BCTypography variant="body4">
              {requirement.description}
            </BCTypography>
          </Box>
        ))}
      </Box>
    </Paper>
  )
}

export const EvidenceOfCompletion = ({
  designatedActionId,
  canEdit = true
}) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [expanded, setExpanded] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newDescription, setNewDescription] = useState('')

  const { data: requirements = [], isLoading } =
    useEvidenceRequirements(designatedActionId)
  const { mutate: createRequirement } =
    useCreateEvidenceRequirement(designatedActionId)
  const { mutate: updateRequirement } =
    useUpdateEvidenceRequirement(designatedActionId)
  const { mutate: removeRequirement } =
    useDeleteEvidenceRequirement(designatedActionId)

  const commitNew = () => {
    const description = newDescription.trim()
    if (description) {
      createRequirement({ description })
    }
    setNewDescription('')
    setAdding(false)
  }

  return (
    <BCBox mt={3} data-test="evidence-of-completion-section">
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

            {requirements.length > 0 && (
              <BCTypography variant="body4" color="text.secondary">
                {t('initiativeAgreement:evidence.autosaveHint')}
              </BCTypography>
            )}

            {!requirements.length && !adding && (
              <BCTypography variant="body4" color="text.secondary">
                {t('initiativeAgreement:evidence.empty')}
              </BCTypography>
            )}

            {adding && (
              <Paper variant="outlined" sx={{ p: 2 }} data-test="eoc-new-card">
                <TextField
                  fullWidth
                  autoFocus
                  size="small"
                  value={newDescription}
                  placeholder={t(
                    'initiativeAgreement:evidence.requirementNamePlaceholder'
                  )}
                  inputProps={{
                    'data-test': 'eoc-new-description',
                    'aria-label': t(
                      'initiativeAgreement:evidence.requirementNamePlaceholder'
                    )
                  }}
                  onChange={(event) => setNewDescription(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitNew()
                    if (event.key === 'Escape') {
                      setNewDescription('')
                      setAdding(false)
                    }
                  }}
                />
                {/* Enter works, but a button is how people expect to
                    commit a new row. */}
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    mt: 1,
                    justifyContent: 'flex-end'
                  }}
                >
                  <BCButton
                    type="button"
                    variant="outlined"
                    color="primary"
                    size="small"
                    data-test="eoc-new-cancel"
                    onClick={() => {
                      setNewDescription('')
                      setAdding(false)
                    }}
                  >
                    {t('initiativeAgreement:evidence.cancel')}
                  </BCButton>
                  <BCButton
                    type="button"
                    variant="contained"
                    color="primary"
                    size="small"
                    data-test="eoc-new-create"
                    disabled={!newDescription.trim()}
                    onClick={commitNew}
                  >
                    {t('initiativeAgreement:evidence.createRequirement')}
                  </BCButton>
                </Box>
              </Paper>
            )}

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
          </Box>
        )}
      </Collapse>
    </BCBox>
  )
}

export default EvidenceOfCompletion
