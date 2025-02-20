import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import {
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar
} from '@mui/material'
import { formatDateWithTimezoneAbbr } from '@/utils/formatters'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  let initials = parts.map((p) => p[0]?.toUpperCase() || '').join('')
  if (initials.length > 2) {
    initials = initials[0] + initials[initials.length - 1]
  }
  return initials || '?'
}

function getAvatarLetters(comment, viewerIsGovernment) {
  const user = comment.createdBy || ''
  const org = comment.createdByOrg || ''

  // Is the author Government of BC?
  const isAuthorGov = org
    .toLowerCase()
    .includes('government of british columbia')

  // If gov comment and viewer is not gov, always show 'BC'
  if (isAuthorGov && !viewerIsGovernment) {
    return 'BC'
  }

  // Otherwise, if there's a user, use their initials
  if (user) {
    return getInitials(user)
  }

  // If user is missing but org is present, use the first letter of org
  if (org) {
    return org.trim().charAt(0).toUpperCase()
  }

  // Fallback if neither user nor org is known
  return '?'
}

function buildLine(comment, viewerIsGovernment, t) {
  const postedDate = formatDateWithTimezoneAbbr(comment.createDate)
  const user = comment.createdBy || ''
  const org = comment.createdByOrg || ''
  const message = comment.comment || ''

  // Is the author Government of BC?
  const isAuthorGov = org
    .toLowerCase()
    .includes('government of british columbia')

  // Gov comment logic
  if (isAuthorGov) {
    // If viewer is gov and we actually have a user name
    if (viewerIsGovernment && user) {
      return t('transfer:commentList.govLineForGov', {
        user,
        date: postedDate,
        comment: message
      })
    }
    // Otherwise, just show Government of BC
    return t('transfer:commentList.govLine', {
      date: postedDate,
      comment: message
    })
  }

  // Non-gov comment logic
  // If user and org are both present
  if (user && org) {
    return t('transfer:commentList.userLine', {
      user,
      org,
      date: postedDate,
      comment: message
    })
  }
  // If user is missing but org is present
  if (!user && org) {
    return t('transfer:commentList.orgLine', {
      org,
      date: postedDate,
      comment: message
    })
  }
}

export const CommentList = ({ comments = [], viewerIsGovernment = false }) => {
  const { t } = useTranslation(['transfer'])

  return (
    <BCBox mt={2} data-test="comment-list">
      <BCTypography variant="h6" color="primary">
        {t('transfer:commentList.title')}
      </BCTypography>

      <List
        aria-label="comments section"
        sx={{
          marginTop: '4px',
          maxWidth: '100%',
          padding: '4px',
          borderRadius: '5px'
        }}
      >
        {comments.map((comment, idx) => {
          const avatarText = getAvatarLetters(comment, viewerIsGovernment)
          const displayLine = buildLine(comment, viewerIsGovernment, t)

          return (
            <BCBox component="div" key={idx}>
              <ListItem alignItems="flex-start" sx={{ p: 0 }}>
                <ListItemAvatar>
                  <Avatar
                    sx={{
                      width: 24,
                      height: 24,
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      bgcolor: '#606060',
                      marginTop: 0.5,
                      marginRight: 3,
                      marginLeft: 3
                    }}
                  >
                    {avatarText}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <BCTypography
                      component="span"
                      variant="subtitle1"
                      color="text.primary"
                    >
                      {displayLine}
                    </BCTypography>
                  }
                />
              </ListItem>
            </BCBox>
          )
        })}
      </List>
    </BCBox>
  )
}

CommentList.propTypes = {
  comments: PropTypes.array.isRequired,
  viewerIsGovernment: PropTypes.bool
}
