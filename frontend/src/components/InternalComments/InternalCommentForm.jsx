// This component renders a form for adding or editing an internal comment.
// It uses ReactQuill for rich text editing.
import PropTypes from 'prop-types'
import ReactQuill from 'react-quill'
import { GlobalStyles } from '@mui/system'
import 'react-quill/dist/quill.snow.css'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'

const InternalCommentForm = ({
  title,
  commentText = '',  // Provide a default empty string
  onSubmit,
  onCancel,
  isEditing = false,
  showAddCommentBtn = true,
  onCommentChange,
  isSubmitting
}) => {
  const { t } = useTranslation(['internalComment'])

  const handleSubmit = () => {
    onSubmit(commentText)
  }

  const isCommentEmpty = !commentText || commentText.trim() === ''

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
      <BCTypography variant="subtitle2" gutterBottom>
        {title}
      </BCTypography>
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
        {showAddCommentBtn && (
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

InternalCommentForm.propTypes = {
  title: PropTypes.string.isRequired,
  commentText: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  isEditing: PropTypes.bool,
  showAddCommentBtn: PropTypes.bool,
  onCommentChange: PropTypes.func,
  isSubmitting: PropTypes.bool
}

export default InternalCommentForm