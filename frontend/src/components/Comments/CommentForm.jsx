import PropTypes from 'prop-types'
import ReactQuill from 'react-quill'
import { GlobalStyles } from '@mui/system'
import Chip from '@mui/material/Chip'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import 'react-quill/dist/quill.snow.css'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'

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
  showTitle = true
}) => {
  const { t } = useTranslation(['internalComment'])

  const handleSubmit = () => {
    onSubmit(commentText, visibility)
  }

  const isCommentEmpty = !commentText || commentText.trim() === ''
  const showVisibilityUnderTitle = showVisibilityToggle && visibilityAlign === 'left'

  return (
    <>
      <GlobalStyles
        styles={{
          '.ql-editor': {
            minHeight: '75px',
            backgroundColor: '#fff'
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
          <BCBox
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              minWidth: 220,
              mt: 0.25
            }}
          >
            <Chip
              label={
                visibility === 'Public'
                  ? t('internalComment:public')
                  : t('internalComment:internal')
              }
              size="small"
              sx={{
                mb: 0.75,
                color: '#fff',
                bgcolor: visibility === 'Public' ? '#187a11' : '#063267',
                minWidth: 92,
                '& .MuiChip-label': {
                  fontSize: '0.88rem',
                  fontWeight: 600
                }
              }}
            />
            <RadioGroup
              row
              value={visibility}
              onChange={(event) => onVisibilityChange?.(event.target.value)}
              sx={{
                columnGap: 1.1,
                alignItems: 'center',
                justifyContent: 'flex-start'
              }}
            >
              <FormControlLabel
                value="Internal"
                labelPlacement="end"
                control={<Radio size="small" sx={{ p: 0.25 }} />}
                label={t('internalComment:internal')}
                sx={{
                  m: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexDirection: 'row',
                  '& .MuiFormControlLabel-label': {
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    lineHeight: 1.15
                  },
                  '& .MuiRadio-root': {
                    mr: -0.15
                  }
                }}
              />
              <FormControlLabel
                value="Public"
                labelPlacement="end"
                control={<Radio size="small" sx={{ p: 0.25 }} />}
                label={t('internalComment:public')}
                sx={{
                  m: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexDirection: 'row',
                  '& .MuiFormControlLabel-label': {
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    lineHeight: 1.15
                  },
                  '& .MuiRadio-root': {
                    mr: -0.15
                  }
                }}
              />
            </RadioGroup>
          </BCBox>
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
          <BCBox
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: visibilityAlign === 'left' ? 'flex-start' : 'flex-end',
              minWidth: 220,
              mt: 0.5
            }}
          >
            <Chip
              label={
                visibility === 'Public'
                  ? t('internalComment:public')
                  : t('internalComment:internal')
              }
              size="small"
              sx={{
                mb: 0.75,
                color: '#fff',
                bgcolor: visibility === 'Public' ? '#187a11' : '#063267',
                minWidth: 92,
                '& .MuiChip-label': {
                  fontSize: '0.88rem',
                  fontWeight: 600
                }
              }}
            />
            <RadioGroup
              row
              value={visibility}
              onChange={(event) => onVisibilityChange?.(event.target.value)}
              sx={{
                columnGap: 1.1,
                alignItems: 'center',
                justifyContent: visibilityAlign === 'left' ? 'flex-start' : 'flex-end'
              }}
            >
              <FormControlLabel
                value="Internal"
                labelPlacement="end"
                control={<Radio size="small" sx={{ p: 0.25 }} />}
                label={t('internalComment:internal')}
                sx={{
                  m: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexDirection: 'row',
                  '& .MuiFormControlLabel-label': {
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    lineHeight: 1.15
                  },
                  '& .MuiRadio-root': {
                    mr: -1.1
                  }
                }}
              />
              <FormControlLabel
                value="Public"
                labelPlacement="end"
                control={<Radio size="small" sx={{ p: 0.25 }} />}
                label={t('internalComment:public')}
                sx={{
                  m: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexDirection: 'row',
                  '& .MuiFormControlLabel-label': {
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    lineHeight: 1.15
                  },
                  '& .MuiRadio-root': {
                    mr: -1.1
                  }
                }}
              />
            </RadioGroup>
          </BCBox>
          )}
        </BCBox>
      )}
      <ReactQuill
        value={commentText}
        onChange={onCommentChange}
        theme="snow"
        modules={{
          toolbar: [
            ['bold', 'italic'],
            [{ list: 'bullet' }, { list: 'ordered' }]
          ],
          keyboard: {
            bindings: { tab: false }
          }
        }}
        formats={['bold', 'italic', 'list', 'bullet']}
      />
      <BCBox sx={{ marginTop: 1 }}>
        {(showAddCommentBtn || isEditing) && (
          <BCButton
            size="small"
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={isCommentEmpty || isSubmitting}
            sx={{ marginRight: 1 }}
          >
            {isEditing
              ? t('internalComment:saveChanges')
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
  showTitle: PropTypes.bool
}

export default CommentForm
