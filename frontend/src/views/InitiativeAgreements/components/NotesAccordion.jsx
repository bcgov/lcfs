import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'

import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ChangeOrderStateChip } from './ChangeOrderStateChip'
import { VersionHistoryButton } from './RecordVersions'
import { packageEditorRoles } from './packageEditors'
import {
  useCreateNote,
  useDeleteNote,
  useInitiativeAgreementNotes,
  useNextNoteNumber,
  useUpdateNote
} from '@/hooks/useInitiativeAgreements'
import { timezoneFormatter } from '@/utils/formatters'
import { sanitizeCommentHtml } from '@/utils/sanitizeCommentHtml'
import { evidencePlainText } from './evidenceRichText'
import { NoteRichTextEditor } from './NoteRichTextEditor'

const NOTE_NUMBER_MAX = 999999
// Whole or with up to two decimals, so a note can sit between two others (1.1).
const NOTE_NUMBER_PATTERN = /^\d+(\.\d{1,2})?$/
const ADDING = 'new'

const errorMessage = (error, fallback) =>
  error?.response?.data?.detail || error?.message || fallback

const editorName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ')

// Quill expresses indentation as classes the sanitizer keeps; the editor's
// stylesheet is not loaded for display, so they are styled here.
const noteContentSx = {
  flex: 1,
  minWidth: 0,
  overflowWrap: 'anywhere',
  '& > :first-child': { mt: 0 },
  '& > :last-child': { mb: 0 },
  '& p, & ul, & ol, & blockquote': { my: 0.75 },
  '& ul, & ol': { pl: 3 },
  ...Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8].map((level) => [
      `& .ql-indent-${level}`,
      { pl: `${level * 3}em` }
    ])
  )
}

const NoteForm = ({
  notes,
  noteId,
  initialNumber,
  initialText,
  onSave,
  onCancel,
  onDelete
}) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [number, setNumber] = useState(String(initialNumber))
  const [text, setText] = useState(initialText)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const validate = () => {
    const parsed = Number(number)
    if (
      !NOTE_NUMBER_PATTERN.test(number.trim()) ||
      parsed <= 0 ||
      parsed > NOTE_NUMBER_MAX
    ) {
      return t('initiativeAgreement:notes.numberInvalid')
    }
    if (
      notes.some(
        (note) =>
          note.noteNumber === parsed &&
          note.initiativeAgreementNoteId !== noteId
      )
    ) {
      return t('initiativeAgreement:notes.numberTaken', { number: parsed })
    }
    if (!evidencePlainText(text)) {
      return t('initiativeAgreement:notes.contentRequired')
    }
    return ''
  }

  const submit = async () => {
    const problem = validate()
    setError(problem)
    if (problem) return
    setSaving(true)
    try {
      await onSave({
        noteNumber: Number(number),
        noteText: sanitizeCommentHtml(text)
      })
    } catch (err) {
      setError(errorMessage(err, t('initiativeAgreement:notes.saveFailed')))
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    try {
      await onDelete()
    } catch (err) {
      setError(errorMessage(err, t('initiativeAgreement:notes.deleteFailed')))
    } finally {
      // BCModal only re-arms its buttons on reopen, so it closes either way;
      // a failure is reported in the form, which stays open.
      setConfirmingDelete(false)
    }
  }

  return (
    <BCBox
      data-test={noteId ? 'edit-note-form' : 'add-note-form'}
      sx={{
        my: 3,
        pl: 2,
        borderLeft: 3,
        borderLeftColor: 'primary.main'
      }}
    >
      <BCTypography variant="subtitle2" color="primary" component="div" mb={1}>
        {noteId
          ? t('initiativeAgreement:notes.editingTitle', {
              number: initialNumber
            })
          : t('initiativeAgreement:notes.newNoteTitle')}
      </BCTypography>
      {error && (
        <BCAlert severity="error" data-test="note-form-error" sx={{ mb: 1 }}>
          {error}
        </BCAlert>
      )}
      <TextField
        size="small"
        type="number"
        value={number}
        onChange={(event) => setNumber(event.target.value)}
        disabled={saving}
        slotProps={{
          htmlInput: {
            min: 0.01,
            max: NOTE_NUMBER_MAX,
            step: 'any',
            'aria-label': t('initiativeAgreement:notes.noteNumber'),
            'data-test': 'note-number-input'
          }
        }}
        sx={{ width: '6rem', mb: 2 }}
      />
      <NoteRichTextEditor
        value={text}
        onChange={setText}
        disabled={saving}
        label={t('initiativeAgreement:notes.noteContent')}
      />
      <BCBox sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
        <BCButton
          type="button"
          variant="contained"
          size="medium"
          color="primary"
          data-test="save-note-button"
          disabled={saving}
          onClick={submit}
          startIcon={<SaveOutlinedIcon fontSize="small" />}
        >
          <BCTypography variant="subtitle2" textTransform="none">
            {t('initiativeAgreement:notes.saveNote')}
          </BCTypography>
        </BCButton>
        <BCButton
          type="button"
          variant="outlined"
          size="medium"
          color="primary"
          data-test="cancel-note-button"
          disabled={saving}
          onClick={onCancel}
        >
          <BCTypography variant="subtitle2" textTransform="none">
            {t('common:cancelBtn')}
          </BCTypography>
        </BCButton>
        {onDelete && (
          <BCButton
            type="button"
            variant="outlined"
            size="medium"
            color="error"
            data-test="delete-note-button"
            disabled={saving}
            onClick={() => setConfirmingDelete(true)}
            startIcon={<DeleteOutlineIcon fontSize="small" />}
          >
            <BCTypography variant="subtitle2" textTransform="none">
              {t('common:deleteBtn')}
            </BCTypography>
          </BCButton>
        )}
      </BCBox>
      {onDelete && (
        <BCModal
          open={confirmingDelete}
          onClose={() => setConfirmingDelete(false)}
          data={{
            title: t('initiativeAgreement:notes.deleteTitle', {
              number: initialNumber
            }),
            primaryButtonText: t('initiativeAgreement:notes.deleteConfirm'),
            primaryButtonColor: 'error',
            primaryButtonAction: confirmDelete,
            secondaryButtonText: t('common:cancelBtn'),
            content: (
              <BCTypography variant="body4" data-test="confirm-delete-note">
                {t('initiativeAgreement:notes.deleteBody')}
              </BCTypography>
            )
          }}
        />
      )}
    </BCBox>
  )
}

const NoteRow = ({ note, canEdit, onEdit }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const name = editorName(note.lastEditedBy)
  const date = note.lastEditedDate
    ? timezoneFormatter({ value: note.lastEditedDate })
    : ''

  return (
    <BCBox
      data-test={`note-${note.noteNumber}`}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        my: 1.5
      }}
    >
      <BCTypography variant="body4" component="strong">
        {note.noteNumber}.
      </BCTypography>
      <BCBox sx={{ flex: 1, minWidth: 0 }}>
        {note.changeOrderState && (
          <ChangeOrderStateChip
            state={note.changeOrderState}
            sx={{ mb: 0.5 }}
          />
        )}
        <BCTypography
          variant="body4"
          component="div"
          className="note-content"
          sx={noteContentSx}
          dangerouslySetInnerHTML={{
            __html: sanitizeCommentHtml(note.noteText)
          }}
        />
        <BCTypography
          variant="body3"
          color="text.secondary"
          data-test={`note-${note.noteNumber}-last-edited`}
          mt={0.5}
        >
          {name
            ? t('initiativeAgreement:notes.lastEdited', { name, date })
            : t('initiativeAgreement:notes.lastEditedUnknown', { date })}
          {' · '}
          <VersionHistoryButton
            recordType="note"
            recordId={note.initiativeAgreementNoteId}
          />
        </BCTypography>
      </BCBox>
      {/* A note being removed in the change order can't be edited. */}
      {canEdit && note.changeOrderState !== 'removed' && (
        <IconButton
          color="primary"
          size="small"
          data-test={`edit-note-${note.noteNumber}`}
          aria-label={t('initiativeAgreement:notes.editNote', {
            number: note.noteNumber
          })}
          onClick={onEdit}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      )}
    </BCBox>
  )
}

// Notes on an initiative agreement (#5486): numbered, kept in number order,
// one added or edited at a time.
export const NotesAccordion = ({
  initiativeAgreementId,
  inChangeOrder = false
}) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const { hasRoles } = useCurrentUser()
  const canEdit = packageEditorRoles(inChangeOrder).some((role) =>
    Boolean(hasRoles?.(role))
  )
  const [editing, setEditing] = useState(null)

  const {
    data: notes = [],
    isLoading,
    isError
  } = useInitiativeAgreementNotes(initiativeAgreementId)
  const { data: nextNumber } = useNextNoteNumber(initiativeAgreementId, {
    enabled: canEdit
  })
  const { mutateAsync: createNote } = useCreateNote(initiativeAgreementId)
  const { mutateAsync: updateNote } = useUpdateNote(initiativeAgreementId)
  const { mutateAsync: deleteNote } = useDeleteNote(initiativeAgreementId)

  const sorted = [...notes].sort((a, b) => a.noteNumber - b.noteNumber)
  const fallbackNumber =
    sorted.reduce((highest, note) => Math.max(highest, note.noteNumber), 0) + 1
  const close = () => setEditing(null)

  return (
    <Accordion
      defaultExpanded
      disableGutters
      variant="outlined"
      data-test="initiative-agreement-notes-section"
      sx={{ mt: 3, '&::before': { display: 'none' } }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ width: '2rem', height: '2rem' }} />}
        aria-controls="initiative-agreement-notes-content"
        id="initiative-agreement-notes-header"
      >
        <BCTypography variant="h6" color="primary" component="div">
          {t('initiativeAgreement:notes.title')}
        </BCTypography>
      </AccordionSummary>
      <AccordionDetails id="initiative-agreement-notes-content">
        {isLoading && (
          <BCTypography variant="body4" color="text.secondary">
            {t('initiativeAgreement:notes.loading')}
          </BCTypography>
        )}
        {isError && (
          <BCAlert severity="error" data-test="notes-load-error">
            {t('initiativeAgreement:notes.loadFailed')}
          </BCAlert>
        )}
        {!isLoading && !isError && sorted.length === 0 && !canEdit && (
          <BCTypography variant="body4" color="text.secondary">
            {t('initiativeAgreement:notes.noNotes')}
          </BCTypography>
        )}
        {sorted.map((note) =>
          editing === note.initiativeAgreementNoteId ? (
            <NoteForm
              key={note.initiativeAgreementNoteId}
              notes={sorted}
              noteId={note.initiativeAgreementNoteId}
              initialNumber={note.noteNumber}
              initialText={note.noteText}
              onCancel={close}
              onSave={async (payload) => {
                await updateNote({
                  noteId: note.initiativeAgreementNoteId,
                  ...payload
                })
                close()
              }}
              onDelete={async () => {
                await deleteNote(note.initiativeAgreementNoteId)
                close()
              }}
            />
          ) : (
            <NoteRow
              key={note.initiativeAgreementNoteId}
              note={note}
              canEdit={canEdit && editing === null}
              onEdit={() => setEditing(note.initiativeAgreementNoteId)}
            />
          )
        )}
        {canEdit &&
          (editing === ADDING ? (
            <NoteForm
              notes={sorted}
              initialNumber={nextNumber ?? fallbackNumber}
              initialText=""
              onCancel={close}
              onSave={async (payload) => {
                await createNote(payload)
                close()
              }}
            />
          ) : (
            <BCButton
              type="button"
              variant="outlined"
              size="medium"
              color="primary"
              data-test="add-note-button"
              disabled={editing !== null}
              onClick={() => setEditing(ADDING)}
              startIcon={<AddIcon fontSize="small" />}
              sx={{ mt: 1 }}
            >
              <BCTypography variant="subtitle2" textTransform="none">
                {t('initiativeAgreement:notes.addNote')}
              </BCTypography>
            </BCButton>
          ))}
      </AccordionDetails>
    </Accordion>
  )
}

export default NotesAccordion
