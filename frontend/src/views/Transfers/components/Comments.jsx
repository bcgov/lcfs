import { Box, Collapse, IconButton, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useFormContext } from 'react-hook-form'
import { LabelBox } from './LabelBox'
import { useTranslation } from 'react-i18next'

export const Comments = ({ editorMode, isGovernmentUser, commentField }) => {
  const { t } = useTranslation(['transfer'])
  const [isExpanded, setIsExpanded] = useState(true)

  const {
    register,
    formState: { errors }
  } = useFormContext()

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    commentField && (
      <>
        <LabelBox
          label={
            (editorMode && t('transfer:commentsLabel')) ||
            (isGovernmentUser && t('transfer:govCommentLabel')) ||
            t('transfer:toOrgCommentLabel')
          }
          description={t('transfer:commentsDescText')}
          data-test="comments"
        >
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            onClick={handleToggle}
            sx={{ cursor: 'pointer' }}
          >
            <IconButton
              data-test="collapse-button"
              aria-label="expand comments"
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Collapse in={isExpanded}>
            <TextField
              data-test="external-comments"
              id="external-comments"
              {...register(commentField)}
              multiline
              fullWidth
              rows={4}
              variant="outlined"
              error={!!errors[commentField]}
              helperText={errors[commentField]?.message}
            />
          </Collapse>
        </LabelBox>
      </>
    )
  )
}
