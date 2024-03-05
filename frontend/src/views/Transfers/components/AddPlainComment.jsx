import { Box, Collapse, IconButton, TextField } from '@mui/material'
import { useState } from 'react'
import PropTypes from 'prop-types'
// MUI Icons
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LabelBox from '../AddEditTransfer/components/LabelBox'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const AddPlainComment = ({
  toOrgId,
  handleCommentChange,
  comment,
  transferStatus,
  isGovernmentUser
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
          <IconButton aria-label="expand comments">
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={isExpanded}>
          <TextField
            multiline
            fullWidth
            rows={4}
            variant="outlined"
            value={comment}
            onChange={handleCommentChange}
          />
        </Collapse>
      </LabelBox>
    </>
  )
}

// Define PropTypes for the component
AddPlainComment.propTypes = {
  toOrgId: PropTypes.any.isRequired,
  handleCommentChange: PropTypes.func.isRequired,
  comment: PropTypes.string.isRequired,
  isGovernmentUser: PropTypes.bool.isRequired,
  transferStatus: PropTypes.string.isRequired
}
