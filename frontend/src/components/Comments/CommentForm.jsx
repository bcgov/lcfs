import PropTypes from 'prop-types'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import ReactQuill from 'react-quill'
import { GlobalStyles } from '@mui/system'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import UndoIcon from '@mui/icons-material/Undo'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import LanguageIcon from '@mui/icons-material/Language'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import 'react-quill/dist/quill.snow.css'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCAlert from '@/components/BCAlert'
import {
  MAX_FILE_SIZE_BYTES,
  COMPLIANCE_REPORT_FILE_TYPES
} from '@/constants/common'
import { validateFile } from '@/utils/fileValidation'
import {
  containsMentionMarkup,
  MENTION_CHIP_STYLE,
  MENTION_COLORS,
  removeMentionMarkup
} from './mentionUtils'
import MentionDropdown from './MentionDropdown'
import { useMentionEditor } from './useMentionEditor'
import './quillExtensions'

const VisibilityToggle = ({
  visibility,
  onVisibilityChange,
  align = 'right',
  marginTop = 0.5
}) => {
  const { t } = useTranslation(['internalComment'])
  const isLeft = align === 'left'

  return (
    <BCBox
      sx={{
        display: 'flex',
        alignItems: isLeft ? 'flex-start' : 'flex-end',
        mt: marginTop
      }}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={visibility}
        onChange={(_, value) => value && onVisibilityChange?.(value)}
        aria-label={t('internalComment:commentVisibility')}
        sx={{
          '& .MuiToggleButton-root': {
            minWidth: 150,
            gap: 0.75,
            py: 1,
            px: 2,
            color: '#003366',
            borderColor: '#b8c5d1',
            fontSize: '1rem',
            fontWeight: 500,
            textTransform: 'none',
            '& .MuiSvgIcon-root': { fontSize: '1.35rem !important' }
          },
          '& .MuiToggleButtonGroup-firstButton': {
            borderTopLeftRadius: '10px !important',
            borderBottomLeftRadius: '10px !important'
          },
          '& .MuiToggleButtonGroup-lastButton': {
            borderTopRightRadius: '10px !important',
            borderBottomRightRadius: '10px !important'
          }
        }}
      >
        <ToggleButton
          value="Internal"
          aria-label={t('internalComment:internalOnly')}
          sx={{
            '&.Mui-selected, &.Mui-selected:hover': {
              color: '#fff !important',
              bgcolor: '#003366',
              '& .MuiSvgIcon-root': { color: '#fff !important' }
            }
          }}
        >
          <LockOutlinedIcon fontSize="small" aria-hidden="true" />
          {t('internalComment:internalOnly')}
        </ToggleButton>
        <ToggleButton
          value="Public"
          aria-label={t('internalComment:public')}
          sx={{
            '&.Mui-selected, &.Mui-selected:hover': {
              color: '#fff !important',
              bgcolor: '#2e7d32',
              '& .MuiSvgIcon-root': { color: '#fff !important' }
            }
          }}
        >
          <LanguageIcon fontSize="small" aria-hidden="true" />
          {t('internalComment:public')}
        </ToggleButton>
      </ToggleButtonGroup>
    </BCBox>
  )
}

VisibilityToggle.propTypes = {
  visibility: PropTypes.oneOf(['Internal', 'Public']).isRequired,
  onVisibilityChange: PropTypes.func,
  align: PropTypes.oneOf(['left', 'right']),
  marginTop: PropTypes.number
}

const CommentForm = ({
  title,
  commentText = '',
  onSubmit,
  onCancel,
  isEditing = false,
  showAddCommentBtn = true,
  onCommentChange,
  isSubmitting,
  showVisibilityToggle = false,
  visibility = 'Internal',
  onVisibilityChange,
  visibilityAlign = 'right',
  showTitle = true,
  enableAttachments = false,
  attachments = [],
  onAttachmentsChange,
  existingAttachments = [],
  onRemoveExistingAttachment,
  onDownloadAttachment,
  enableMentions = false,
  mentionResults = { data: [], isFetching: false },
  onMentionQueryChange = () => {}
}) => {
  const { t } = useTranslation(['internalComment'])
  const fileInputRef = useRef(null)
  const mentionConflictId = `comment-mention-conflict-${useId()}`
  const quillRef = useRef(null)
  const [attachmentError, setAttachmentError] = useState(null)
  // Pre-removal HTML after "Remove mentions", so that choice can be undone.
  const [removedMentionsSnapshot, setRemovedMentionsSnapshot] = useState(null)
  const mentionEditor = useMentionEditor({
    quillRef,
    enabled: enableMentions,
    results: mentionResults,
    onQueryChange: onMentionQueryChange
  })

  const attachmentsEnabled = enableAttachments && !!onAttachmentsChange

  // Public comments can't carry mentions of internal staff. Switching to
  // Public leaves the text untouched and asks the user to resolve it (the
  // backend also strips mentions from Public comments).
  const hasMentionConflict =
    showVisibilityToggle &&
    visibility === 'Public' &&
    containsMentionMarkup(commentText)
  // While Public the toolbar button stays visible but disabled.
  const mentionsPausedByVisibility =
    showVisibilityToggle && visibility === 'Public'

  const handleSubmit = () => {
    if (hasMentionConflict) return
    onSubmit(commentText, visibility)
  }

  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }

  const handleFilesSelected = (event) => {
    const selected = Array.from(event.target.files || [])
    // Reset the input so selecting the same file again still fires onChange.
    event.target.value = ''
    if (selected.length === 0) {
      return
    }

    const valid = []
    const errors = []
    selected.forEach((file) => {
      const result = validateFile(
        file,
        MAX_FILE_SIZE_BYTES,
        COMPLIANCE_REPORT_FILE_TYPES
      )
      if (result.isValid) {
        valid.push(file)
      } else {
        errors.push(`"${file.name}": ${result.errorMessage}`)
      }
    })

    setAttachmentError(errors.length ? errors.join(' ') : null)
    if (valid.length) {
      onAttachmentsChange([...attachments, ...valid])
    }
  }

  const handleRemoveStaged = (index) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index))
  }

  const handleVisibilityChange = useCallback(
    (newVisibility) => {
      if (newVisibility === 'Internal') setRemovedMentionsSnapshot(null)
      onVisibilityChange?.(newVisibility)
    },
    [onVisibilityChange]
  )

  const handleRemoveMentions = useCallback(() => {
    setRemovedMentionsSnapshot(commentText)
    onCommentChange(removeMentionMarkup(commentText))
  }, [commentText, onCommentChange])

  const handleKeepInternal = useCallback(() => {
    handleVisibilityChange('Internal')
  }, [handleVisibilityChange])

  const handleUndoRemoveMentions = useCallback(() => {
    if (removedMentionsSnapshot === null) return
    onCommentChange(removedMentionsSnapshot)
    setRemovedMentionsSnapshot(null)
    onVisibilityChange?.('Internal')
  }, [removedMentionsSnapshot, onCommentChange, onVisibilityChange])

  const handleEditorChange = (content, _delta, source, editor) => {
    // A manual edit makes the "Undo" snapshot stale.
    if (source === 'user' && removedMentionsSnapshot !== null) {
      setRemovedMentionsSnapshot(null)
    }
    onCommentChange(content)
    mentionEditor.handleEditorChange(editor)
  }

  // Quill renders the toolbar buttons' innerHTML itself, so tooltip/aria
  // labels have to be set imperatively once the toolbar DOM exists.
  useEffect(() => {
    const quill = quillRef.current?.getEditor?.()
    const toolbar = quill?.getModule('toolbar')?.container
    if (!toolbar) return

    const setTooltip = (selector, label) => {
      const button = toolbar.querySelector(selector)
      if (!button) return
      button.setAttribute('title', label)
      button.setAttribute('aria-label', label)
      button.setAttribute('type', 'button')
    }

    setTooltip('.ql-bold', t('internalComment:toolbarBold'))
    setTooltip('.ql-italic', t('internalComment:toolbarItalic'))
    setTooltip(
      '.ql-list[value="bullet"]',
      t('internalComment:toolbarBulletList')
    )
    setTooltip(
      '.ql-list[value="ordered"]',
      t('internalComment:toolbarNumberedList')
    )
    if (attachmentsEnabled) {
      setTooltip('.ql-attach', t('internalComment:attachFile'))
    }
    const mentionButton = toolbar.querySelector('.ql-mention')
    if (mentionButton) {
      // The button is always in the toolbar config: changing `modules` would
      // rebuild the whole editor. Only its presentation changes here: hidden
      // when mentions aren't allowed, disabled while the comment is Public.
      mentionButton.style.display =
        enableMentions || mentionsPausedByVisibility ? '' : 'none'
      if (enableMentions) {
        mentionButton.removeAttribute('aria-disabled')
        setTooltip('.ql-mention', t('internalComment:mentionButtonLabel'))
      } else if (mentionsPausedByVisibility) {
        mentionButton.setAttribute('aria-disabled', 'true')
        setTooltip(
          '.ql-mention',
          t('internalComment:mentionButtonDisabledPublic')
        )
      }
    }
  }, [attachmentsEnabled, enableMentions, mentionsPausedByVisibility, t])

  // Memoized so Quill isn't re-initialized on every render.
  const quillModules = useMemo(() => {
    const container = [
      ['bold', 'italic'],
      [{ list: 'bullet' }, { list: 'ordered' }]
    ]
    if (attachmentsEnabled) {
      container.push(['attach'])
    }
    container.push(['mention'])
    return {
      toolbar: {
        container,
        handlers: {
          attach: handleAttachClick,
          mention: mentionEditor.handleButtonClick
        }
      },
      keyboard: {
        bindings: { tab: false }
      }
    }
    // `handleAttachClick` only touches a ref, so it can be left out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentsEnabled])

  const isCommentEmpty = !commentText || commentText.trim() === ''
  const showVisibilityUnderTitle =
    showVisibilityToggle && visibilityAlign === 'left'

  return (
    <>
      <GlobalStyles
        styles={{
          '.ql-editor': {
            minHeight: '75px',
            backgroundColor: '#fff',
            fontSize: '1rem',
            lineHeight: 1.5
          },
          '.ql-toolbar.ql-snow': {
            border: 'none !important',
            borderBottom: '1px solid #ccc !important'
          },
          '.ql-toolbar.ql-snow .ql-mention:not([aria-disabled="true"]).ql-active, .ql-toolbar.ql-snow .ql-mention:not([aria-disabled="true"]):hover':
            {
              color: `${MENTION_COLORS.activeBlue} !important`
            },
          '.ql-toolbar.ql-snow .ql-mention:not([aria-disabled="true"]).ql-active .ql-stroke, .ql-toolbar.ql-snow .ql-mention:not([aria-disabled="true"]):hover .ql-stroke':
            {
              stroke: `${MENTION_COLORS.activeBlue} !important`
            },
          '.ql-toolbar.ql-snow .ql-mention[aria-disabled="true"]': {
            opacity: 0.4,
            cursor: 'not-allowed'
          },
          // Mentions that are blocked by a Public visibility choice: amber +
          // dashed (not colour alone) so they read as "needs attention".
          '[data-mention-conflict="true"] .ql-editor .mention': {
            backgroundColor: '#fff4e5',
            color: '#7a4100',
            outline: '1px dashed #ed6c02'
          },
          '.ql-editor .mention': MENTION_CHIP_STYLE
        }}
      />
      <BCBox sx={{ mb: 1 }}>
        {showTitle && showVisibilityUnderTitle && (
          <BCTypography variant="subtitle2" gutterBottom sx={{ mb: 0.5 }}>
            {title}
          </BCTypography>
        )}
        {showVisibilityUnderTitle && (
          <VisibilityToggle
            visibility={visibility}
            onVisibilityChange={handleVisibilityChange}
            align="left"
            marginTop={0.25}
          />
        )}
      </BCBox>
      {!showVisibilityUnderTitle && (
        <BCBox
          sx={{
            mb: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 2
          }}
        >
          {showTitle && (
            <BCTypography variant="subtitle2" gutterBottom sx={{ mb: 0 }}>
              {title}
            </BCTypography>
          )}
          {showVisibilityToggle && (
            <VisibilityToggle
              visibility={visibility}
              onVisibilityChange={handleVisibilityChange}
              align={visibilityAlign}
            />
          )}
        </BCBox>
      )}
      {showVisibilityToggle && (
        <BCBox
          role="status"
          data-test="comment-visibility-message"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            mb: 1,
            px: 1,
            py: 0.5,
            color: visibility === 'Public' ? '#256428' : '#003366',
            border: '1px solid',
            borderColor: visibility === 'Public' ? '#2e7d32' : '#1769aa',
            bgcolor: visibility === 'Public' ? '#f4fbf4' : '#f4f8fc',
            fontSize: '0.875rem'
          }}
        >
          {visibility === 'Public' ? (
            <LanguageIcon fontSize="small" aria-hidden="true" />
          ) : (
            <LockOutlinedIcon fontSize="small" aria-hidden="true" />
          )}
          <span>
            {visibility === 'Public'
              ? t('internalComment:publicVisibilityMessage')
              : t('internalComment:internalVisibilityMessage')}
          </span>
        </BCBox>
      )}
      {hasMentionConflict && (
        <Alert
          id={mentionConflictId}
          severity="warning"
          sx={{ mb: 1 }}
          data-test="comment-mention-conflict"
        >
          {t('internalComment:mentionsBlocked')}
          <BCBox sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <BCButton
              size="small"
              variant="outlined"
              color="primary"
              onClick={handleKeepInternal}
              data-test="comment-mention-keep-internal"
            >
              {t('internalComment:keepInternal')}
            </BCButton>
            <BCButton
              size="small"
              variant="contained"
              color="primary"
              onClick={handleRemoveMentions}
              data-test="comment-mention-remove"
            >
              {t('internalComment:removeMentions')}
            </BCButton>
          </BCBox>
        </Alert>
      )}
      {!hasMentionConflict && removedMentionsSnapshot !== null && (
        <Alert
          severity="info"
          role="status"
          sx={{ mb: 1 }}
          data-test="comment-mentions-removed-notice"
        >
          {t('internalComment:mentionsConverted')}
          <BCBox sx={{ mt: 1 }}>
            <BCButton
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<UndoIcon />}
              onClick={handleUndoRemoveMentions}
              data-test="comment-mentions-undo"
            >
              {t('internalComment:undo')}
            </BCButton>
          </BCBox>
        </Alert>
      )}
      <div data-mention-conflict={hasMentionConflict ? 'true' : 'false'}>
        <ReactQuill
          ref={quillRef}
          // Remount only to refresh the placeholder: a remount re-parses the
          // value and trims whitespace, so skip it once there's content.
          key={showVisibilityToggle && isCommentEmpty ? visibility : 'static'}
          value={commentText}
          onChange={handleEditorChange}
          onChangeSelection={mentionEditor.handleSelectionChange}
          placeholder={
            showVisibilityToggle
              ? visibility === 'Public'
                ? t('internalComment:publicCommentPlaceholder')
                : t('internalComment:internalCommentPlaceholder')
              : undefined
          }
          theme="snow"
          modules={quillModules}
          formats={['bold', 'italic', 'list', 'bullet', 'mention']}
        />
      </div>
      {enableMentions && mentionEditor.mention && (
        <MentionDropdown
          getAnchorRect={mentionEditor.getAnchorRect}
          results={mentionEditor.users}
          isLoading={mentionResults.isFetching}
          activeIndex={mentionEditor.mention.activeIndex}
          onHoverIndex={mentionEditor.setActiveIndex}
          onSelect={mentionEditor.selectMention}
          t={t}
        />
      )}
      {attachmentsEnabled && (
        <BCBox sx={{ mt: 1 }}>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept={COMPLIANCE_REPORT_FILE_TYPES.ACCEPT_STRING}
            onChange={handleFilesSelected}
            data-test="comment-attachment-input"
          />
          {attachmentError && (
            <BCAlert
              severity="error"
              dismissible
              sx={{ mb: 1 }}
              onClose={() => setAttachmentError(null)}
              data-test="comment-attachment-error"
            >
              {attachmentError}
            </BCAlert>
          )}
          {(existingAttachments.length > 0 || attachments.length > 0) && (
            <BCBox
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 0.5 }}
              data-test="comment-attachment-chips"
            >
              {existingAttachments.map((doc) => (
                <Chip
                  key={`existing-${doc.documentId}`}
                  label={doc.fileName}
                  size="small"
                  variant="outlined"
                  onClick={
                    onDownloadAttachment
                      ? () => onDownloadAttachment(doc.documentId, doc.fileName)
                      : undefined
                  }
                  onDelete={
                    onRemoveExistingAttachment
                      ? () => onRemoveExistingAttachment(doc.documentId)
                      : undefined
                  }
                  sx={{ maxWidth: 260 }}
                />
              ))}
              {attachments.map((file, index) => (
                <Chip
                  key={`staged-${index}-${file.name}`}
                  label={file.name}
                  size="small"
                  onDelete={() => handleRemoveStaged(index)}
                  sx={{ maxWidth: 260 }}
                />
              ))}
            </BCBox>
          )}
        </BCBox>
      )}
      <BCBox sx={{ marginTop: 1 }}>
        {(showAddCommentBtn || isEditing) && (
          <BCButton
            size="small"
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={isCommentEmpty || isSubmitting || hasMentionConflict}
            aria-describedby={
              hasMentionConflict ? mentionConflictId : undefined
            }
            startIcon={
              !isEditing && showVisibilityToggle ? (
                visibility === 'Public' ? (
                  <LanguageIcon />
                ) : (
                  <LockOutlinedIcon />
                )
              ) : undefined
            }
            sx={{
              marginRight: 1,
              // theme's `.MuiButton-containedSizeSmall svg { fontSize: ... !important }`
              // otherwise beats the icon's own size, hence the extra specificity here
              '&.MuiButton-containedSizeSmall .MuiButton-startIcon svg': {
                fontSize: '1.15rem !important'
              },
              ...(!isEditing &&
                showVisibilityToggle && {
                  bgcolor: visibility === 'Public' ? '#2e7d32' : '#003366',
                  '&:hover': {
                    bgcolor: visibility === 'Public' ? '#256428' : '#00264d'
                  }
                })
            }}
          >
            {isEditing
              ? t('internalComment:saveChanges')
              : showVisibilityToggle
                ? visibility === 'Public'
                  ? t('internalComment:addPublicComment')
                  : t('internalComment:addInternalComment')
                : t('internalComment:addComment')}
          </BCButton>
        )}
        {isEditing && (
          <BCButton
            size="small"
            variant="outlined"
            color="primary"
            onClick={onCancel}
          >
            {t('internalComment:cancel')}
          </BCButton>
        )}
      </BCBox>
    </>
  )
}

CommentForm.propTypes = {
  title: PropTypes.string.isRequired,
  commentText: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  isEditing: PropTypes.bool,
  showAddCommentBtn: PropTypes.bool,
  onCommentChange: PropTypes.func,
  isSubmitting: PropTypes.bool,
  showVisibilityToggle: PropTypes.bool,
  visibility: PropTypes.oneOf(['Internal', 'Public']),
  onVisibilityChange: PropTypes.func,
  visibilityAlign: PropTypes.oneOf(['left', 'right']),
  showTitle: PropTypes.bool,
  enableAttachments: PropTypes.bool,
  attachments: PropTypes.array,
  onAttachmentsChange: PropTypes.func,
  existingAttachments: PropTypes.array,
  onRemoveExistingAttachment: PropTypes.func,
  onDownloadAttachment: PropTypes.func,
  enableMentions: PropTypes.bool,
  mentionResults: PropTypes.shape({
    data: PropTypes.array,
    isFetching: PropTypes.bool
  }),
  onMentionQueryChange: PropTypes.func
}

export default CommentForm
