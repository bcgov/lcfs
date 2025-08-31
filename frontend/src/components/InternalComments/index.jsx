import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useInternalComments } from '@/hooks/useInternalComments'
import InternalCommentList from './InternalCommentList'
import Loading from '@/components/Loading'

const InternalComments = ({ entityType, entityId }) => {
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
    handleCommentInputChange
  } = useInternalComments(entityType, entityId)

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

  const handleEditComment = async (commentId, commentText) => {
    await editComment({ commentId, commentText })
  }

  return (
    <InternalCommentList
      comments={comments}
      onAddComment={handleAddComment}
      onEditComment={handleEditComment}
      showAddCommentBtn={showAddCommentBtn}
      isAddingComment={isAddingComment}
      isEditingComment={isEditingComment}
      commentInput={commentInput}
      onCommentInputChange={handleCommentInputChange}
    />
  )
}

InternalComments.propTypes = {
  entityType: PropTypes.string.isRequired,
  entityId: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.oneOf([null])]),
  onCommentChange: PropTypes.func
}

export default InternalComments
