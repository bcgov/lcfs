import { useState, useEffect } from 'react'
import { Box, Typography, Collapse, IconButton, TextField } from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useFormContext } from 'react-hook-form'
import { LabelBox } from './LabelBox'
import { useTranslation } from 'react-i18next'

export const Comments = ({ commentField, isEditable }) => {
  const { t } = useTranslation(['txn'])
  const [isExpanded, setIsExpanded] = useState(false)

  const { register, getValues } = useFormContext()

  // Automatically expand the TextField if it has an initial value
  useEffect(() => {
    setTimeout(() => {
      const value = getValues(commentField)
      if (value) {
        setIsExpanded(true)
      }
    }, 0)
  }, [commentField, getValues])

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    commentField && (
      <>
        <LabelBox label={t('txn:commentsLabel')}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            onClick={handleToggle}
            sx={{ cursor: 'pointer' }}
          >
            <Typography variant="body2">{t('txn:commentsDescText')}</Typography>
            <IconButton>
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Collapse in={isExpanded}>
            <TextField
              id="external-comments"
              data-test="external-comments"
              {...register(commentField)}
              multiline
              fullWidth
              rows={4}
              disabled={!isEditable}
              variant="outlined"
            />
          </Collapse>
        </LabelBox>
      </>
    )
  )
}
