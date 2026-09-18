import PropTypes from 'prop-types'
import { useMemo, useRef, useState } from 'react'
import ReactQuill from 'react-quill'
import { GlobalStyles } from '@mui/system'
import Chip from '@mui/material/Chip'
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

// Register a paperclip icon for the custom Quill "attach" toolbar button.
// `react-quill` exposes Quill as a static property of its default export
// (not a separate named export), so access it that way to stay safe across
// bundler CJS/ESM interop. Quill's icon registry is global — register once.
const Quill = ReactQuill.Quill
const quillIcons = Quill.import('ui/icons')
quillIcons.attach =
  '<svg viewBox="0 0 18 18"><path class="ql-stroke" d="M14.5,7.5l-5.6,5.6c-1.3,1.3-3.4,1.3-4.7,0c-1.3-1.3-1.3-3.4,0-4.7l6-6c0.8-0.8,2.2-0.8,3,0c0.8,0.8,0.8,2.2,0,3l-6,6c-0.4,0.4-1,0.4-1.3,0c-0.4-0.4-0.4-1,0-1.3l5.3-5.3"/></svg>'

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
  onDownloadAttachment
}) => {
  const { t } = useTranslation(['internalComment'])
  const fileInputRef = useRef(null)
  const [attachmentError, setAttachmentError] = useState(null)

  const attachmentsEnabled = enableAttachments && !!onAttachmentsChange

  const handleSubmit = () => {
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

  // Toolbar config is memoized so Quill doesn't reinitialize each render. The
  // custom "attach" button triggers the hidden file input via its handler.
  const quillModules = useMemo(() => {
    const container = [
      ['bold', 'italic'],
      [{ list: 'bullet' }, { list: 'ordered' }]
    ]
    if (attachmentsEnabled) {
      container.push(['attach'])
    }
    return {
      toolbar: {
        container,
        handlers: { attach: handleAttachClick }
      },
      keyboard: {
        bindings: { tab: false }
      }
    }
    // handleAttachClick only reads a stable ref, so depend on the toggle.
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
          }
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
            onVisibilityChange={onVisibilityChange}
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
              onVisibilityChange={onVisibilityChange}
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
      <ReactQuill
        key={showVisibilityToggle ? visibility : 'static'}
        value={commentText}
        onChange={onCommentChange}
        placeholder={
          showVisibilityToggle
            ? visibility === 'Public'
              ? t('internalComment:publicCommentPlaceholder')
              : t('internalComment:internalCommentPlaceholder')
            : undefined
        }
        theme="snow"
        modules={quillModules}
        formats={['bold', 'italic', 'list', 'bullet']}
      />
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
            disabled={isCommentEmpty || isSubmitting}
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
  onDownloadAttachment: PropTypes.func
}

export default CommentForm
