// This component renders a form for adding or editing an internal comment.
// It uses ReactQuill for rich text editing.

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import ReactQuill from 'react-quill';
import { GlobalStyles } from '@mui/system';
import 'react-quill/dist/quill.snow.css';
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'

const InternalCommentForm = ({ title, initialCommentText = '', onSubmit, onCancel, isEditing = false }) => {
  const { t } = useTranslation(['intComment'])
  const [commentText, setCommentText] = useState(initialCommentText);

  useEffect(() => {
    setCommentText(initialCommentText);
  }, [initialCommentText, isEditing]);

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
      <BCTypography variant="subtitle2" gutterBottom>{title}</BCTypography>
      <ReactQuill
        value={commentText}
        onChange={setCommentText}
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
        <BCButton
          size="small"
          variant="contained"
          color="primary"
          onClick={() => onSubmit(commentText)}
          disabled={!commentText.trim()}
          sx={{ marginRight: 1 }}
        >
          {isEditing ? t('intComment:saveChanges') : t('intComment:addComment')}
        </BCButton>
        {isEditing && (
          <BCButton
            size="small"
            variant="outlined"
            color="primary"
            onClick={onCancel}
          >
            {t('intComment:cancel')}
          </BCButton>
        )}
      </BCBox>
    </>
  );
};

InternalCommentForm.propTypes = {
  title: PropTypes.string.isRequired,
  initialCommentText: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  isEditing: PropTypes.bool,
};

export default InternalCommentForm;
