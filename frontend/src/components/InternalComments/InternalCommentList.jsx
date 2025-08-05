// This component renders a list of internal comments and includes functionality
// for editing and adding new comments. It showcases the use of child components
// and passing callback functions for interactive features.
import { useState } from 'react'
import PropTypes from 'prop-types'
import { GlobalStyles } from '@mui/system'
import Avatar from '@mui/material/Avatar'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import EditIcon from '@mui/icons-material/Edit'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useTranslation } from 'react-i18next'
import InternalCommentForm from './InternalCommentForm'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'

const InternalCommentList = ({
  comments,
  onAddComment,
  onEditComment,
  showAddCommentBtn = true,
  isAddingComment,
  isEditingComment,
  commentInput,
  onCommentInputChange
}) => {
  const { t } = useTranslation(['internalComment'])
  const { data: currentUser, hasAnyRole } = useCurrentUser()
  const [editCommentId, setEditCommentId] = useState(null)
  const [editCommentText, setEditCommentText] = useState('')

  const startEditing = (id, text) => {
    setEditCommentId(id)
    setEditCommentText(text)
  }

  const stopEditing = () => {
    setEditCommentId(null)
    setEditCommentText('')
  }

  const submitEdit = () => {
    onEditComment(editCommentId, editCommentText)
    stopEditing()
  }

  const handleEditCommentChange = (value) => {
    setEditCommentText(value)
  }

  // Formats the provided date string into a readable format.
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

  // Renders the timestamp for a comment, indicating if it has been edited.
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

  // Extracts and formats initials from a full name for use in the Avatar component.
  const getInitials = (name) => {
    if (!name) {
      return ''
    }
    const names = name.split(' ')
    const initials = names.map((n) => n[0]).join('')
    return initials.toUpperCase()
  }

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
                <InternalCommentForm
                  title={t('internalComment:editComment')}
                  commentText={editCommentText}
                  onSubmit={submitEdit}
                  onCancel={stopEditing}
                  onCommentChange={handleEditCommentChange}
                  isEditing={true}
                  isSubmitting={isEditingComment}
                  showAddCommentBtn={true}
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
                    <BCTypography variant="body2" color="text" component="span">
                      <CommentTimestamp
                        createDate={comment.createDate}
                        updateDate={comment.updateDate}
                      />
                    </BCTypography>
                    {currentUser.keycloakUsername === comment.createUser && (
                      <Tooltip title={t('internalComment:edit')} arrow>
                        <IconButton
                          onClick={() =>
                            startEditing(
                              comment.internalCommentId,
                              comment.comment
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
        {/* Conditionally renders the form to add a new comment based on the user's role */}
        {hasAnyRole(
          roles.analyst,
          roles.director,
          roles.compliance_manager
        ) && (
          <BCBox sx={{ backgroundColor: '#fff' }} p={2}>
            <InternalCommentForm
              title={
                ((hasAnyRole(roles.analyst) ||
                  hasAnyRole(roles.compliance_manager)) &&
                  t('internalComment:commentToDirector')) ||
                (hasAnyRole(roles.director) &&
                  t('internalComment:commentToAnalyst'))
              }
              onSubmit={onAddComment}
              showAddCommentBtn={showAddCommentBtn}
              commentText={commentInput || ''}
              onCommentChange={onCommentInputChange}
              isSubmitting={isAddingComment}
              isEditing={false}
            />
          </BCBox>
        )}
      </BCBox>
    </>
  )
}

InternalCommentList.propTypes = {
  comments: PropTypes.arrayOf(
    PropTypes.shape({
      internalCommentId: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.string
      ]).isRequired,
      comment: PropTypes.string.isRequired,
      fullName: PropTypes.string.isRequired,
      createDate: PropTypes.string.isRequired,
      updateDate: PropTypes.string
    })
  ).isRequired,
  onAddComment: PropTypes.func.isRequired,
  onEditComment: PropTypes.func.isRequired,
  showAddCommentBtn: PropTypes.bool,
  isAddingComment: PropTypes.bool,
  isEditingComment: PropTypes.bool,
  commentInput: PropTypes.string,
  onCommentInputChange: PropTypes.func
}

export default InternalCommentList
