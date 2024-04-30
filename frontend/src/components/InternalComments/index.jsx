// This component manages the display and interaction logic for internal comments
// related to a specific entity, allowing for viewing, adding, and editing comments.

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next'
import { useApiService } from '@/services/useApiService'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import InternalCommentList from './InternalCommentList';
import Loading from '@/components/Loading'

const InternalComments = ({ entityType, entityId }) => {
  const { t } = useTranslation(['internalComment'])
  const apiService = useApiService()
  const { hasAnyRole } = useCurrentUser()
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addCommentKey, setAddCommentKey] = useState(0);
  const showAddCommentBtn = entityId === null ? false : true;

  // Determines the audience scope for a new comment based on the user's roles.
  const getAudienceScope = () => {
    if (hasAnyRole(roles.analyst)) {
      return 'Director';
    } else if (hasAnyRole(roles.director)) {
      return 'Analyst';
    }
  };

  // Handles the creation of a new comment.
  const addComment = async (entityType, entityId, commentText) => {
    try {
      const payload = {
        entityType,
        entityId,
        comment: commentText,
        audience_scope: getAudienceScope()
      };
      
      const response = await apiService.post('/internal_comments/', payload);
      return response.data;
    } catch (error) {
      console.error('Failed to add comment:', error);
      throw error;
    }
  };

  // Handles the update of an existing comment.
  const editComment = async (commentId, commentText) => {
    try {
      const payload = {
        comment: commentText
      };

      const response = await apiService.put(`/internal_comments/${commentId}`, payload);
      return response.data;
    } catch (error) {
      console.error('Failed to update comment:', error);
      throw error;
    }
  };

  // Loads comments for the specified entity when component mounts or entityId changes.
  useEffect(() => {
    if (!showAddCommentBtn)
      return;

    const loadComments = async () => {
      setIsLoading(true);
      try {
        // const fetchedComments = await fetchComments(entityType, entityId);
        const response = await apiService.get(`/internal_comments/${entityType}/${entityId}`);
        const fetchedComments = response.data;
        const sortedComments = fetchedComments.sort((a, b) => b.internalCommentId - a.internalCommentId);
        setComments(sortedComments);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadComments();
  }, [entityType, entityId]);

  // Adds a newly created comment to the local state.
  const handleAddComment = async (commentText) => {
    try {
      const newComment = await addComment(entityType, entityId, commentText);
      setComments((prevComments) => {
        const insertIndex = prevComments.findIndex((comment) => newComment.id > comment.id);
        if (insertIndex === -1) {
          return [newComment, ...prevComments]; // Newest or only comment
        } else {
          return [
            ...prevComments.slice(0, insertIndex),
            newComment,
            ...prevComments.slice(insertIndex),
          ];
        }
      });
      setAddCommentKey(prevKey => prevKey + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  // Updates an existing comment in the local state.
  const handleEditComment = async (commentId, commentText) => {
    try {
      const updatedComment = await editComment(commentId, commentText);
      setComments(prevComments =>
        prevComments.map(comment => comment.internalCommentId === updatedComment.internalCommentId ? updatedComment : comment)
      );
    } catch (err) {
      setError(err.message);
    }
  };

  if (isLoading) return <Loading message={t('internalComment:loadingComments')} />;
  if (error) return <div>{t('internalComment:errorLoadingComments')} {error}</div>;

  return (
    <InternalCommentList
      comments={comments}
      onAddComment={handleAddComment}
      onEditComment={handleEditComment}
      addCommentFormKey={addCommentKey}
      showAddCommentBtn={showAddCommentBtn}
    />
  );
};

InternalComments.propTypes = {
  entityType: PropTypes.string.isRequired,
  entityId: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.oneOf([null])
  ])
};

export default InternalComments;
