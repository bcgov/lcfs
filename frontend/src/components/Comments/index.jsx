import PropTypes from 'prop-types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useComments } from '@/hooks/useComments'
import { useMentionableUsers } from '@/hooks/useMentionableUsers'
import CommentList from './CommentList'
import Loading from '@/components/Loading'

const Comments = ({
  entityType,
  entityId,
  commentMode = 'internal-only',
  enableAttachments = true
}) => {
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
    attachments,
    handleAttachmentsChange,
    downloadCommentAttachment,
    visibility,
    handleVisibilityChange,
    allowInternalVisibility,
    sortOrder,
    handleSortOrderChange
  } = useComments(entityType, entityId, { commentMode })

  // One lookup is shared by the add form and any comment being edited.
  // `null` means no lookup is in progress.
  const [mentionQuery, setMentionQuery] = useState(null)
  const mentionResults = useMentionableUsers(
    mentionQuery ?? '',
    mentionQuery !== null
  )

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

  const handleEditComment = async (
    commentId,
    commentText,
    visibility,
    fileChanges = {}
  ) => {
    await editComment({ commentId, commentText, visibility, ...fileChanges })
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
      enableAttachments={enableAttachments}
      attachments={attachments}
      onAttachmentsChange={handleAttachmentsChange}
      onDownloadAttachment={downloadCommentAttachment}
      sortOrder={sortOrder}
      onSortOrderChange={handleSortOrderChange}
      mentionResults={mentionResults}
      onMentionQueryChange={setMentionQuery}
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
  commentMode: PropTypes.oneOf(['internal-only', 'dual']),
  enableAttachments: PropTypes.bool
}

export default Comments
