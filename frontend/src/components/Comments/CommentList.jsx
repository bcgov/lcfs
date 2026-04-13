import { useState } from 'react'
import PropTypes from 'prop-types'
import { GlobalStyles } from '@mui/system'
import Avatar from '@mui/material/Avatar'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import EditIcon from '@mui/icons-material/Edit'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useTranslation } from 'react-i18next'
import CommentForm from './CommentForm'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'

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
  allowInternalVisibility = true
}) => {
  const { t } = useTranslation(['internalComment'])
  const { data: currentUser, hasAnyRole } = useCurrentUser()
  const [editCommentId, setEditCommentId] = useState(null)
  const [editCommentText, setEditCommentText] = useState('')
  const [editVisibility, setEditVisibility] = useState('Internal')

  const isGov = hasAnyRole(
    roles.analyst,
    roles.director,
    roles.compliance_manager,
    roles.government
  )
  const isDualMode = commentMode === 'dual'

  const startEditing = (id, text, visibilityValue = 'Internal') => {
    setEditCommentId(id)
    setEditCommentText(text)
    setEditVisibility(visibilityValue)
  }

  const stopEditing = () => {
    setEditCommentId(null)
    setEditCommentText('')
    setEditVisibility('Internal')
  }

  const submitEdit = () => {
    onEditComment(editCommentId, editCommentText, editVisibility)
    stopEditing()
  }

  const handleEditCommentChange = (value) => {
    setEditCommentText(value)
  }

  const formatDate = (dateString) => {
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    }
    return new Date(dateString).toLocaleDateString(undefined, options)
  }

  const CommentTimestamp = ({ createDate, updateDate }) => {
    const isEdited = updateDate && createDate !== updateDate
    return (
      <span>
        {formatDate(createDate)}
        {isEdited && (
          <>
            <span>&nbsp;-&nbsp;</span>
            <span style={{ color: 'red' }}>{t('internalComment:edited')}</span>
            <Tooltip title={`Edited ${formatDate(updateDate)}`} arrow>
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
    if (
      hasAnyRole(roles.analyst) ||
      hasAnyRole(roles.compliance_manager)
    ) {
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
        {comments.map((comment, index) => (
          <BCBox
            key={comment.internalCommentId}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              paddingLeft: 2,
              paddingBottom: 1,
              backgroundColor:
                (comments.length - 1 - index) % 2 === 0
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
                  visibilityAlign="left"
                />
              ) : (
                <BCBox>
                  <BCBox
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <BCBox sx={{ display: 'flex', alignItems: 'center' }}>
                      <BCTypography variant="body2" color="text" component="span">
                        <CommentTimestamp
                          createDate={comment.createDate}
                          updateDate={comment.updateDate}
                        />
                      </BCTypography>
                    </BCBox>
                    <BCBox sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isGov && currentUser.keycloakUsername === comment.createUser && (
                        <Tooltip title={t('internalComment:edit')} arrow>
                          <IconButton
                            onClick={() =>
                              startEditing(
                                comment.internalCommentId,
                                comment.comment,
                                comment.visibility || 'Internal'
                              )
                            }
                            sx={{
                              color: '#003366',
                              transform: 'scale(1.2)',
                              marginTop: '2px'
                            }}
                            aria-label={t('internalComment:edit')}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
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
                </BCBox>
              )}
            </BCBox>
          </BCBox>
        ))}
        {canAddComment && (
          <BCBox sx={{ backgroundColor: '#fff' }} p={2}>
            <CommentForm
              title={getFormTitle()}
              onSubmit={onAddComment}
              showAddCommentBtn={showAddCommentBtn}
              commentText={commentInput || ''}
              onCommentChange={onCommentInputChange}
              isSubmitting={isAddingComment}
              isEditing={false}
              showVisibilityToggle={showVisibilityToggle}
              visibility={visibility}
              onVisibilityChange={onVisibilityChange}
              visibilityAlign="left"
            />
          </BCBox>
        )}
      </BCBox>
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
      visibility: PropTypes.string
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
  allowInternalVisibility: PropTypes.bool
}

export default CommentList
