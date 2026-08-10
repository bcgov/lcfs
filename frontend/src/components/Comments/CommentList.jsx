import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { GlobalStyles } from '@mui/system'
import Avatar from '@mui/material/Avatar'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import AppBar from '@mui/material/AppBar'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useTranslation } from 'react-i18next'
import CommentForm from './CommentForm'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCModal from '@/components/BCModal'

const CommentList = ({
  comments,
  onAddComment,
  onEditComment,
  showAddCommentBtn = true,
  isAddingComment,
  isEditingComment,
  commentInput,
  onCommentInputChange,
  commentMode = 'internal-only',
  visibility = 'Internal',
  onVisibilityChange,
  allowInternalVisibility = true,
  enableAttachments = false,
  attachments = [],
  onAttachmentsChange,
  onDownloadAttachment,
  sortOrder = 'desc',
  onSortOrderChange
}) => {
  const { t } = useTranslation(['internalComment'])
  const { data: currentUser, hasAnyRole } = useCurrentUser()
  const [editCommentId, setEditCommentId] = useState(null)
  const [editCommentText, setEditCommentText] = useState('')
  const [editVisibility, setEditVisibility] = useState('Internal')
  const [editOriginalVisibility, setEditOriginalVisibility] =
    useState('Internal')
  const [commentFilter, setCommentFilter] = useState('all')
  // Attachment changes staged while editing a comment.
  const [editNewFiles, setEditNewFiles] = useState([])
  const [editRemovedDocIds, setEditRemovedDocIds] = useState([])

  const isGov = hasAnyRole(
    roles.analyst,
    roles.director,
    roles.compliance_manager,
    roles.government
  )
  // Administrators may edit any comment regardless of authorship.
  const isAdmin = hasAnyRole(roles.administrator)
  const isDualMode = commentMode === 'dual'

  const startEditing = (id, text, visibilityValue = 'Internal') => {
    setEditCommentId(id)
    setEditCommentText(text)
    setEditVisibility(visibilityValue)
    setEditOriginalVisibility(visibilityValue)
    setEditNewFiles([])
    setEditRemovedDocIds([])
  }

  const stopEditing = () => {
    setEditCommentId(null)
    setEditCommentText('')
    setEditVisibility('Internal')
    setEditOriginalVisibility('Internal')
    setEditNewFiles([])
    setEditRemovedDocIds([])
  }

  const submitEdit = () => {
    const performEdit = () => {
      onEditComment(editCommentId, editCommentText, editVisibility, {
        newFiles: editNewFiles,
        removedDocumentIds: editRemovedDocIds
      })
      stopEditing()
    }

    if (
      isDualMode &&
      isGov &&
      editVisibility === 'Public' &&
      editOriginalVisibility !== 'Public'
    ) {
      setPendingPublicAction(() => performEdit)
      return
    }
    performEdit()
  }
  const handleEditCommentChange = (value) => {
    setEditCommentText(value)
  }
  const formatDate = (dateString) => {
    const options = {
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }
    return new Date(dateString).toLocaleDateString(undefined, options)
  }

  const CommentTimestamp = ({
    createDate,
    updateDate,
    updateFullName,
    updateUser,
    createUser
  }) => {
    const isEdited = updateDate && createDate !== updateDate
    const editorName = updateFullName || updateUser
    // Only show editor when different from author (e.g. admin correction).
    const showEditor =
      isEdited && editorName && updateUser && updateUser !== createUser
    const editedLabel = showEditor
      ? t('internalComment:editedBy', { name: editorName })
      : t('internalComment:edited')
    const tooltipLabel = `Edited ${formatDate(updateDate)}`
    return (
      <span>
        {formatDate(createDate)}
        {isEdited && (
          <>
            <span>&nbsp;-&nbsp;</span>
            <span style={{ color: 'red' }} data-test="comment-edited-indicator">
              {editedLabel}
            </span>
            <Tooltip title={tooltipLabel} arrow>
              <span style={{ marginLeft: '4px' }}>
                <InfoOutlinedIcon
                  fontSize="medium"
                  sx={{
                    marginLeft: '1px',
                    verticalAlign: 'text-top',
                    transform: 'scale(0.8)'
                  }}
                  aria-label={`Comment edited on ${formatDate(updateDate)}`}
                  role="img"
                />
              </span>
            </Tooltip>
          </>
        )}
      </span>
    )
  }

  const getInitials = (name) => {
    if (!name) {
      return ''
    }
    const names = name.split(' ')
    const initials = names.map((n) => n[0]).join('')
    return initials.toUpperCase()
  }

  // Determine the form title
  const getFormTitle = () => {
    if (isDualMode) {
      if (!isGov) {
        // Non-gov views already have organization context around this section.
        return t('internalComment:addComment')
      }
      // Gov user in dual mode: title depends on visibility selection
      if (visibility === 'Public') {
        return t('internalComment:commentToOrganization')
      }
    }
    // Internal-only mode or internal visibility in dual mode
    if (hasAnyRole(roles.analyst) || hasAnyRole(roles.compliance_manager)) {
      return t('internalComment:commentToDirector')
    }
    if (hasAnyRole(roles.director)) {
      return t('internalComment:commentToAnalyst')
    }
    return t('internalComment:addComment')
  }

  // Determine if the current user can add comments
  const canAddComment = isDualMode
    ? true // Both gov and BCeID can comment in dual mode
    : hasAnyRole(roles.analyst, roles.director, roles.compliance_manager)

  // Show visibility toggle only for gov users in dual mode
  const showVisibilityToggle = isDualMode && isGov && allowInternalVisibility
  const showCommentTabs = isDualMode && isGov
  const showSortTabs = isDualMode

  const filteredComments = useMemo(() => {
    if (!showCommentTabs || commentFilter === 'all') {
      return comments
    }

    return comments.filter((comment) => {
      const commentVisibility =
        comment.visibility === 'Public' ? 'public' : 'internal'
      return commentVisibility === commentFilter
    })
  }, [comments, commentFilter, showCommentTabs])

  const performAddComment = async (...args) => {
    await onAddComment(...args)
    if (showCommentTabs && commentFilter !== 'all') {
      setCommentFilter('all')
    }
    if (sortOrder !== 'desc') {
      onSortOrderChange?.('desc')
    }
  }

  const [pendingPublicAction, setPendingPublicAction] = useState(null)

  const handleAddComment = async (...args) => {
    if (isDualMode && isGov && visibility === 'Public') {
      setPendingPublicAction(() => () => performAddComment(...args))
      return
    }
    await performAddComment(...args)
  }

  const confirmPendingPublicAction = async () => {
    const action = pendingPublicAction
    setPendingPublicAction(null)
    await action?.()
  }

  const cancelPendingPublicAction = () => setPendingPublicAction(null)

  return (
    <>
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
        {showSortTabs && (
          <BCBox
            sx={{
              backgroundColor: '#fff',
              p: 2,
              pb: 1,
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: showCommentTabs
                  ? 'minmax(0, 700px) minmax(290px, 340px) 1fr'
                  : 'minmax(290px, 340px) 1fr'
              },
              alignItems: 'center',
              gap: 2
            }}
          >
            {showCommentTabs && (
              <AppBar
                position="static"
                sx={{
                  boxShadow: 'none',
                  border: 'none',
                  mb: 0,
                  minWidth: 0,
                  width: '100%'
                }}
              >
                <Tabs
                  value={commentFilter}
                  onChange={(_, value) => setCommentFilter(value)}
                  aria-label={t('internalComment:commentFilterTabs')}
                  data-test="comment-filter-tabs"
                  sx={{
                    background: 'rgb(0, 0, 0, 0.08)',
                    width: '100%',
                    '& .MuiTab-root': {
                      flex: 1,
                      minWidth: 0,
                      px: { xs: 1, md: 1.5 }
                    }
                  }}
                >
                  <Tab
                    value="internal"
                    label={t('internalComment:internalComments')}
                    data-test="comment-filter-internal"
                  />
                  <Tab
                    value="public"
                    label={t('internalComment:publicComments')}
                    data-test="comment-filter-public"
                  />
                  <Tab
                    value="all"
                    label={t('internalComment:allComments')}
                    data-test="comment-filter-all"
                  />
                </Tabs>
              </AppBar>
            )}
            <AppBar
              position="static"
              sx={{
                boxShadow: 'none',
                border: 'none',
                mb: 0,
                minWidth: 0,
                width: { xs: '100%', md: 'auto' }
              }}
            >
              <Tabs
                value={sortOrder}
                onChange={(_, value) => value && onSortOrderChange?.(value)}
                aria-label={t('internalComment:sortCommentsLabel')}
                data-test="comment-sort-toggle"
                sx={{
                  background: 'rgb(0, 0, 0, 0.08)',
                  width: { xs: '100%', md: 'auto' },
                  '& .MuiTab-root': {
                    minWidth: { xs: 0, md: 145 },
                    px: { xs: 1, md: 2 }
                  }
                }}
              >
                <Tab
                  value="desc"
                  label={t('internalComment:sortNewestFirst')}
                  data-test="comment-sort-newest"
                />
                <Tab
                  value="asc"
                  label={t('internalComment:sortOldestFirst')}
                  data-test="comment-sort-oldest"
                />
              </Tabs>
            </AppBar>
          </BCBox>
        )}
        {filteredComments.map((comment, index) => (
          <BCBox
            key={comment.internalCommentId}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              paddingLeft: 2,
              paddingBottom: 1,
              backgroundColor:
                (filteredComments.length - 1 - index) % 2 === 0
                  ? 'transparent'
                  : '#ffffff'
            }}
          >
            <Tooltip title={comment.fullName} arrow>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  bgcolor: '#606060',
                  marginTop: 2.5,
                  marginRight: 2
                }}
                aria-label={`Comment by ${comment.fullName}`}
                role="img"
              >
                {getInitials(comment.fullName)}
              </Avatar>
            </Tooltip>
            <BCBox
              sx={{
                marginRight: 3,
                padding: 1,
                paddingLeft: 0,
                borderBottom: '1px solid #666666',
                width: '100%'
              }}
            >
              {editCommentId === comment.internalCommentId ? (
                <>
                  {isAdmin &&
                    comment.createUser &&
                    comment.createUser !== currentUser?.keycloakUsername && (
                      <BCTypography
                        variant="subtitle2"
                        sx={{ mb: 0.5, color: '#a12622' }}
                        data-test="admin-edit-notice"
                      >
                        {t('internalComment:editingOthersComment', {
                          name: comment.fullName || comment.createUser
                        })}
                      </BCTypography>
                    )}
                  <CommentForm
                    title={t('internalComment:editComment')}
                    commentText={editCommentText}
                    onSubmit={submitEdit}
                    onCancel={stopEditing}
                    onCommentChange={handleEditCommentChange}
                    isEditing={true}
                    isSubmitting={isEditingComment}
                    showAddCommentBtn={true}
                    showVisibilityToggle={showVisibilityToggle}
                    visibility={editVisibility}
                    onVisibilityChange={setEditVisibility}
                    visibilityAlign="right"
                    enableAttachments={enableAttachments}
                    attachments={editNewFiles}
                    onAttachmentsChange={setEditNewFiles}
                    existingAttachments={(comment.documents || []).filter(
                      (doc) => !editRemovedDocIds.includes(doc.documentId)
                    )}
                    onRemoveExistingAttachment={(documentId) =>
                      setEditRemovedDocIds((ids) => [...ids, documentId])
                    }
                    onDownloadAttachment={(documentId, fileName) =>
                      onDownloadAttachment?.(
                        comment.internalCommentId,
                        documentId,
                        fileName
                      )
                    }
                  />
                </>
              ) : (
                <BCBox>
                  <BCBox
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <BCBox
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <BCTypography
                        variant="body2"
                        color="text"
                        component="span"
                      >
                        <CommentTimestamp
                          createDate={comment.createDate}
                          updateDate={comment.updateDate}
                          updateUser={comment.updateUser}
                          updateFullName={comment.updateFullName}
                          createUser={comment.createUser}
                        />
                      </BCTypography>
                      {(currentUser?.keycloakUsername === comment.createUser ||
                        isAdmin) && (
                        <BCTypography
                          variant="body2"
                          component="a"
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            startEditing(
                              comment.internalCommentId,
                              comment.comment,
                              comment.visibility || 'Internal'
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              startEditing(
                                comment.internalCommentId,
                                comment.comment,
                                comment.visibility || 'Internal'
                              )
                            }
                          }}
                          sx={{
                            color: '#003366',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                          aria-label={t('internalComment:edit')}
                          data-test="comment-edit-link"
                        >
                          [{t('internalComment:edit')}]
                        </BCTypography>
                      )}
                    </BCBox>
                    <BCBox
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      {isDualMode && isGov && comment.visibility && (
                        <Chip
                          label={
                            comment.visibility === 'Public'
                              ? t('internalComment:public')
                              : t('internalComment:internal')
                          }
                          size="small"
                          sx={{
                            color: '#fff',
                            bgcolor:
                              comment.visibility === 'Public'
                                ? '#187a11'
                                : '#063267',
                            minWidth: 88,
                            height: 24,
                            '& .MuiChip-label': {
                              fontSize: '0.86rem',
                              fontWeight: 600
                            }
                          }}
                        />
                      )}
                    </BCBox>
                  </BCBox>

                  <div
                    className="comment-content"
                    dangerouslySetInnerHTML={{ __html: comment.comment }}
                  />
                  {(comment.documents || []).length > 0 && (
                    <BCBox
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 2,
                        mt: 0.5
                      }}
                      data-test="comment-attachments"
                    >
                      {comment.documents.map((doc) => (
                        <BCTypography
                          key={doc.documentId}
                          variant="body2"
                          component="a"
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            onDownloadAttachment?.(
                              comment.internalCommentId,
                              doc.documentId,
                              doc.fileName
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onDownloadAttachment?.(
                                comment.internalCommentId,
                                doc.documentId,
                                doc.fileName
                              )
                            }
                          }}
                          sx={{
                            color: '#003366',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                          aria-label={`${t('internalComment:downloadAttachment')}: ${
                            doc.fileName
                          }`}
                        >
                          {doc.fileName}
                        </BCTypography>
                      ))}
                    </BCBox>
                  )}
                </BCBox>
              )}
            </BCBox>
          </BCBox>
        ))}
        {canAddComment && (
          <BCBox sx={{ backgroundColor: '#fff' }} p={2}>
            <CommentForm
              title={getFormTitle()}
              onSubmit={handleAddComment}
              showAddCommentBtn={showAddCommentBtn}
              commentText={commentInput || ''}
              onCommentChange={onCommentInputChange}
              isSubmitting={isAddingComment}
              isEditing={false}
              showVisibilityToggle={showVisibilityToggle}
              visibility={visibility}
              onVisibilityChange={onVisibilityChange}
              visibilityAlign="right"
              enableAttachments={enableAttachments}
              attachments={attachments}
              onAttachmentsChange={onAttachmentsChange}
            />
          </BCBox>
        )}
      </BCBox>
      {pendingPublicAction && (
        <BCModal
          open={!!pendingPublicAction}
          onClose={cancelPendingPublicAction}
          data={{
            title: t('internalComment:publicCommentConfirmTitle'),
            content: (
              <BCTypography variant="body2" color="text">
                {t('internalComment:publicCommentConfirmText')}
              </BCTypography>
            ),
            primaryButtonText: t('internalComment:postComment'),
            primaryButtonAction: confirmPendingPublicAction,
            secondaryButtonText: t('internalComment:cancel'),
            secondaryButtonAction: cancelPendingPublicAction
          }}
        />
      )}
    </>
  )
}

CommentList.propTypes = {
  comments: PropTypes.arrayOf(
    PropTypes.shape({
      internalCommentId: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.string
      ]).isRequired,
      comment: PropTypes.string.isRequired,
      fullName: PropTypes.string.isRequired,
      createDate: PropTypes.string.isRequired,
      updateDate: PropTypes.string,
      updateUser: PropTypes.string,
      updateFullName: PropTypes.string,
      createUser: PropTypes.string,
      visibility: PropTypes.string,
      documents: PropTypes.array
    })
  ).isRequired,
  onAddComment: PropTypes.func.isRequired,
  onEditComment: PropTypes.func.isRequired,
  showAddCommentBtn: PropTypes.bool,
  isAddingComment: PropTypes.bool,
  isEditingComment: PropTypes.bool,
  commentInput: PropTypes.string,
  onCommentInputChange: PropTypes.func,
  commentMode: PropTypes.oneOf(['internal-only', 'dual']),
  visibility: PropTypes.oneOf(['Internal', 'Public']),
  onVisibilityChange: PropTypes.func,
  allowInternalVisibility: PropTypes.bool,
  enableAttachments: PropTypes.bool,
  attachments: PropTypes.array,
  onAttachmentsChange: PropTypes.func,
  onDownloadAttachment: PropTypes.func,
  sortOrder: PropTypes.oneOf(['asc', 'desc']),
  onSortOrderChange: PropTypes.func
}

export default CommentList
