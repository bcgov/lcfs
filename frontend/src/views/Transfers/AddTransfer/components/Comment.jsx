import React, { useState } from 'react'
import { Box, Collapse, IconButton, TextField, Typography } from '@mui/material'

// MUI Icons
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

const Comment = () => {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <>
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
        <TextField multiline fullWidth rows={4} variant="outlined" />
      </Collapse>
    </>
  )
}

export default Comment
