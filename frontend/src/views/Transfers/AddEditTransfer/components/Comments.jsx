import { Box, Collapse, IconButton, TextField } from '@mui/material'
import { useState } from 'react'

// MUI Icons
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useFormContext } from 'react-hook-form'
import LabelBox from './LabelBox'
import { useTranslation } from 'react-i18next'

const Comments = () => {
  const { t } = useTranslation(['transfer'])
  const [isExpanded, setIsExpanded] = useState(false)

  const { register } = useFormContext()

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <>
      <LabelBox
        label={t('transfer:commentsLabel')}
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
            {...register('comments')}
            multiline
            fullWidth
            rows={4}
            variant="outlined"
          />
        </Collapse>
      </LabelBox>
    </>
  )
}

export default Comments
