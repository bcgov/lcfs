import PropTypes from 'prop-types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useComments } from '@/hooks/useComments'
import { useMentionableUsers } from '@/hooks/useMentionableUsers'
import CommentList from './CommentList'
import Loading from '@/components/Loading'
import BCAlert from '@/components/BCAlert'
import { getCommentErrorMessage } from './commentErrors'

const Comments = ({
  entityType,
  entityId,
  commentMode = 'internal-only',
  enableAttachments = true,
  showUploadDropzone = false,
  enableDeletion = false,
  enableSorting = true,
  showTitle = true,
  placeholder
}) => {
  const { t } = useTranslation(['internalComment'])
  const {
    comments,
    canComment,
    isLoading,
    error,
    addComment,
    editComment,
    cancelEditComment,
    deleteComment,
    isDeletingComment,
    mutationError,
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
    <>
      {mutationError && (
        <BCAlert severity="error" role="alert">
          {t('internalComment:saveError')}{' '}
          {getCommentErrorMessage(mutationError)}
        </BCAlert>
      )}
      <CommentList
        comments={comments}
        onAddComment={handleAddComment}
        onEditComment={handleEditComment}
        onCancelEdit={cancelEditComment}
        onDeleteComment={enableDeletion ? deleteComment : undefined}
        isDeletingComment={isDeletingComment}
        showTitle={showTitle}
        placeholder={placeholder}
        canCreateComment={entityType === 'penaltyLog' ? canComment : undefined}
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
        showUploadDropzone={showUploadDropzone}
        attachments={attachments}
        onAttachmentsChange={handleAttachmentsChange}
        onDownloadAttachment={downloadCommentAttachment}
        sortOrder={sortOrder}
        enableSorting={enableSorting}
        onSortOrderChange={handleSortOrderChange}
        mentionResults={mentionResults}
        onMentionQueryChange={setMentionQuery}
      />
    </>
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
  enableAttachments: PropTypes.bool,
  showUploadDropzone: PropTypes.bool,
  enableDeletion: PropTypes.bool,
  enableSorting: PropTypes.bool,
  showTitle: PropTypes.bool,
  placeholder: PropTypes.string
}

export default Comments
