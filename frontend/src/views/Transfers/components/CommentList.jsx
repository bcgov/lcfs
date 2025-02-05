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
  const { createdBy = '', createdByOrg = '' } = comment

  const isAuthorGov = createdByOrg
    .toLowerCase()
    .includes('government of british columbia')

  // If the author is government and the viewer is not government, always show 'BC'
  if (isAuthorGov && !viewerIsGovernment) {
    return 'BC'
  }

  // Otherwise, return initials of the author
  return getInitials(createdBy)
}

function buildLine(comment, viewerIsGovernment, t) {
  const postedDate = formatDateWithTimezoneAbbr(comment.createDate)
  const isAuthorGov = (comment.createdByOrg || '')
    .toLowerCase()
    .includes('government of british columbia')

  // Fallback if fields are missing
  const user = comment.createdBy || t('transfer:commentList.unknownUser')
  const org = comment.createdByOrg || t('transfer:commentList.unknownOrg')
  const message = comment.comment || ''

  if (isAuthorGov) {
    if (viewerIsGovernment) {
      return t('transfer:commentList.govLineForGov', {
        user,
        government: t('transfer:commentList.governmentOfBC'),
        date: postedDate,
        comment: message
      })
    } else {
      return t('transfer:commentList.govLine', {
        government: t('transfer:commentList.governmentOfBC'),
        date: postedDate,
        comment: message
      })
    }
  }

  // For a non-government author
  return t('transfer:commentList.userLine', {
    user,
    org,
    date: postedDate,
    comment: message
  })
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
