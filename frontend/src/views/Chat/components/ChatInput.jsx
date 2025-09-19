import React from 'react'
import { Box, TextField, IconButton, InputAdornment } from '@mui/material'
import BCButton from '@/components/BCButton'
import SendIcon from '@mui/icons-material/Send'
import StopIcon from '@mui/icons-material/Stop'

export const ChatInput = ({
  value,
  onChange,
  onSend,
  onStop,
  disabled = false,
  isStreaming = false,
  placeholder = "Ask me about accounting, LCFS regulations, or compliance..."
}) => {
  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!disabled && !isStreaming && value.trim()) {
        onSend()
      }
    }
  }

  const handleSend = () => {
    if (!disabled && !isStreaming && value.trim()) {
      onSend()
    }
  }

  const handleStop = () => {
    if (isStreaming && onStop) {
      onStop()
    }
  }

  return (
    <Box
      component="form"
      sx={{
        p: 2,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}
      onSubmit={(e) => {
        e.preventDefault()
        handleSend()
      }}
    >
      <Box display="flex" gap={1} alignItems="flex-end">
        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          variant="outlined"
          size="small"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {isStreaming ? (
                  <IconButton
                    onClick={handleStop}
                    color="error"
                    size="small"
                    title="Stop generation"
                  >
                    <StopIcon />
                  </IconButton>
                ) : (
                  <IconButton
                    onClick={handleSend}
                    disabled={disabled || !value.trim()}
                    color="primary"
                    size="small"
                    title="Send message"
                  >
                    <SendIcon />
                  </IconButton>
                )}
              </InputAdornment>
            )
          }}
        />

        <BCButton
          variant="contained"
          color="primary"
          onClick={isStreaming ? handleStop : handleSend}
          disabled={disabled || (!isStreaming && !value.trim())}
          size="medium"
          sx={{ minWidth: 80 }}
        >
          {isStreaming ? 'Stop' : 'Send'}
        </BCButton>
      </Box>
    </Box>
  )
}