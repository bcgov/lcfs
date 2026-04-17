import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useComments } from '@/hooks/useComments'
import CommentList from './CommentList'
import Loading from '@/components/Loading'

const Comments = ({ entityType, entityId, commentMode = 'internal-only' }) => {
  const { t } = useTranslation(['internalComment'])
  const {
    comments,
    isLoading,
    error,
    addComment,
    editComment,
    isAddingComment,
    isEditingComment,
    commentInput,
    handleCommentInputChange,
    visibility,
    handleVisibilityChange,
    allowInternalVisibility
  } = useComments(entityType, entityId, { commentMode })

  const showAddCommentBtn = entityId !== null

  if (isLoading) {
    return <Loading message={t('internalComment:loadingComments')} />
  }
  if (error) {
    return (
      <div>
        {t('internalComment:errorLoadingComments')} {error.message}
      </div>
    )
  }

  const handleAddComment = async () => {
    await addComment()
  }

  const handleEditComment = async (commentId, commentText, visibility) => {
    await editComment({ commentId, commentText, visibility })
  }

  return (
    <CommentList
      comments={comments}
      onAddComment={handleAddComment}
      onEditComment={handleEditComment}
      showAddCommentBtn={showAddCommentBtn}
      isAddingComment={isAddingComment}
      isEditingComment={isEditingComment}
      commentInput={commentInput}
      onCommentInputChange={handleCommentInputChange}
      commentMode={commentMode}
      visibility={visibility}
      onVisibilityChange={handleVisibilityChange}
      allowInternalVisibility={allowInternalVisibility}
    />
  )
}

Comments.propTypes = {
  entityType: PropTypes.string.isRequired,
  entityId: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
    PropTypes.oneOf([null])
  ]),
  commentMode: PropTypes.oneOf(['internal-only', 'dual'])
}

export default Comments
