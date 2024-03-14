// This component renders a list of internal comments and includes functionality
// for editing and adding new comments. It showcases the use of child components
// and passing callback functions for interactive features.

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { GlobalStyles } from '@mui/system';
import Avatar from '@mui/material/Avatar';
import { useTranslation } from 'react-i18next'
import InternalCommentForm from './InternalCommentForm';
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'

const InternalCommentList = ({ comments, onAddComment, onEditComment, addCommentFormKey }) => {
  const { t } = useTranslation(['intComment'])
  const { data: currentUser, hasAnyRole } = useCurrentUser()
  const [editCommentId, setEditCommentId] = useState(null);
  const startEditing = (id) => setEditCommentId(id);
  const stopEditing = () => setEditCommentId(null);

  // Submits the edited comment and resets the editing state.
  const submitEdit = (text) => {
    onEditComment(editCommentId, text);
    stopEditing();
  };

  // Formats the provided date string into a readable format.
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Renders the timestamp for a comment, indicating if it has been edited.
  const CommentTimestamp = ({ createDate, updateDate }) => {
    const isEdited = updateDate && createDate !== updateDate;
    return (
      <span>
        {formatDate(createDate)}
        {isEdited && (
          <span>
            {' - ('}
            <span style={{ color: 'red' }}>{t('intComment:edited')}</span>
            {` ${formatDate(updateDate)})`}
          </span>
        )}
      </span>
    );
  };

  // Extracts and formats initials from a full name for use in the Avatar component.
  const getInitials = (name) => {
    if (!name) {
      return '';
    }
    const names = name.split(' ');
    const initials = names.map((n) => n[0]).join('');
    return initials.toUpperCase();
  };

  return (
    <>
    {/* Global styles for customizing comment content appearance */}
      <GlobalStyles
        styles={{
          '.comment-content': {
            fontSize: '1rem'
          },
          '.comment-content ul, .comment-content ol': {
            paddingLeft: '35px',
            marginTop: '0'
          },
          'comment-content li': {
            lineHeight: '1.6'
          }
        }}
      />
      <BCBox
          variant="bordered"
          borderRadius="sm"
          mt={1}
          mb={1}
          sx={{ backgroundColor: '#f2f2f2' }}
        >
        {comments.map((comment, index) => (
          <BCBox key={comment.internalCommentId} sx={{ display: 'flex', alignItems: 'flex-start', paddingLeft: 2 }}>
            <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: '#606060', marginTop: 2.5, marginRight: 2 }}>{getInitials(comment.fullName)}</Avatar>
            <BCBox sx={{
              marginBottom: index === comments.length - 1 ? 2 : 0,
              marginRight: 3,
              padding: 1,
              paddingLeft: 0,
              borderBottom: '1px solid #666666',
              width: '100%'
            }}>
              {editCommentId === comment.internalCommentId ? (
                <InternalCommentForm
                  title={t('intComment:editComment')}
                  initialCommentText={comment.comment}
                  onSubmit={submitEdit}
                  onCancel={stopEditing}
                  isEditing
                />
              ) : (
                <BCBox>
                  <BCTypography variant="body2" color="text.secondary" component="span">
                    {comment.fullName}, <CommentTimestamp createDate={comment.createDate} updateDate={comment.updateDate} />
                    {currentUser.keycloakUsername === comment.createUser && (
                      <span 
                        style={{ cursor: 'pointer', marginLeft: '10px', color: '#1976d2' }}
                        onClick={() => startEditing(comment.internalCommentId)}
                      >
                        {t('intComment:edit')}
                      </span>
                    )}
                  </BCTypography>
                  
                  <div
                    className="comment-content"
                    dangerouslySetInnerHTML={{ __html: comment.comment }}
                  />
                </BCBox>
              )}
            </BCBox>
          </BCBox>
        ))}
         {/* Conditionally renders the form to add a new comment based on the user's role */}
        { (hasAnyRole(roles.analyst, roles.director)) && (
          <BCBox sx={{ backgroundColor: '#fff' }}  p={2}>
            <InternalCommentForm
              title={
                (hasAnyRole(roles.analyst) && t('intComment:commentToDirector')) ||
                (hasAnyRole(roles.director) && t('intComment:commentToAnalyst'))
              }
              onSubmit={onAddComment}
              key={addCommentFormKey}
            />
          </BCBox>
        )}
      </BCBox>
    </>
  );
};

InternalCommentList.propTypes = {
  comments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      text: PropTypes.string.isRequired,
      author: PropTypes.string.isRequired,
      timestamp: PropTypes.string.isRequired,
    })
  ).isRequired,
  onAddComment: PropTypes.func.isRequired,
  onEditComment: PropTypes.func.isRequired,
};

export default InternalCommentList;
