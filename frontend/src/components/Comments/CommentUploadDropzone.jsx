import { useState } from 'react'
import PropTypes from 'prop-types'
import ButtonBase from '@mui/material/ButtonBase'
import { useTranslation } from 'react-i18next'

const CommentUploadDropzone = ({
  onClick,
  onFilesSelected,
  disabled = false
}) => {
  const { t } = useTranslation(['internalComment'])
  const [isDragging, setIsDragging] = useState(false)

  return (
    <ButtonBase
      type="button"
      disabled={disabled}
      onClick={onClick}
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (disabled) return
        event.dataTransfer.dropEffect = 'copy'
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setIsDragging(false)
        if (!disabled) {
          onFilesSelected(Array.from(event.dataTransfer.files || []))
        }
      }}
      aria-label={t('internalComment:uploadDropzoneLabel')}
      className="comment-upload-dropzone"
      data-test="comment-upload-dropzone"
      sx={{
        width: '100%',
        minHeight: 58,
        p: 1,
        border: '1px dashed',
        borderColor: isDragging ? 'primary.main' : '#8c8c8c',
        borderRadius: 1,
        bgcolor: isDragging ? 'action.hover' : 'transparent',
        fontSize: '0.875rem',
        lineHeight: 1.5,
        textAlign: 'center',
        '&.Mui-focusVisible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2
        },
        '&.Mui-disabled': { opacity: 0.5 }
      }}
    >
      <span>
        <span style={{ color: '#003366', textDecoration: 'underline' }}>
          {t('internalComment:clickToUpload')}
        </span>{' '}
        {t('internalComment:orDragAndDrop')}
      </span>
    </ButtonBase>
  )
}

CommentUploadDropzone.propTypes = {
  onClick: PropTypes.func.isRequired,
  onFilesSelected: PropTypes.func.isRequired,
  disabled: PropTypes.bool
}

export default CommentUploadDropzone
