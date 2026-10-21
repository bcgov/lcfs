import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import { useState } from 'react'
import PropTypes from 'prop-types'
// MUI Icons
import { LabelBox } from './LabelBox'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'

export const AddPlainComment = ({
  toOrgId,
  handleCommentChange,
  comment,
  transferStatus,
  isGovernmentUser = false
}) => {
  const { t } = useTranslation(['transfer'])
  const { sameOrganization } = useCurrentUser()
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }
  if (
    !(
      (isGovernmentUser &&
        ['Submitted', 'Recommended'].includes(transferStatus)) ||
      (sameOrganization(toOrgId) && transferStatus === 'Sent')
    )
  )
    return null

  return (
    <>
      <LabelBox
        label={
          (isGovernmentUser && t('transfer:govCommentLabel')) ||
          (sameOrganization(toOrgId) && t('transfer:toOrgCommentLabel'))
        }
        description={t('transfer:commentsDescText')}
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          onClick={handleToggle}
          sx={{ cursor: 'pointer' }}
        >
          <IconButton data-test="toggle-comments" aria-label="expand comments">
            {isExpanded ? (
              <ExpandLess data-testid="ExpandLessIcon" />
            ) : (
              <ExpandMore data-testid="ExpandMoreIcon" />
            )}
          </IconButton>
        </Box>

        <Collapse in={isExpanded}>
          <TextField
            data-test="comment-input"
            multiline
            fullWidth
            rows={4}
            variant="outlined"
            value={comment}
            onChange={(e) => handleCommentChange(e.target.value)}
          />
        </Collapse>
      </LabelBox>
    </>
  )
}

AddPlainComment.propTypes = {
  toOrgId: PropTypes.any.isRequired,
  handleCommentChange: PropTypes.func.isRequired,
  comment: PropTypes.string.isRequired,
  isGovernmentUser: PropTypes.bool,
  transferStatus: PropTypes.string.isRequired
}
