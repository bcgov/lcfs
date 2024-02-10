import React, { useState } from 'react'
import { Box, Collapse, IconButton, TextField, Typography } from '@mui/material'

// MUI Icons
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import LabelBox from './LabelBox'

const Comments = ({ register }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <>
      <LabelBox
        label="Comments (optional)"
        description="Your comments will be visible to both organizations of the transfer and government:"
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
