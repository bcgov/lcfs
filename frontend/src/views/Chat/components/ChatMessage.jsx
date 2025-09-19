import React from 'react'
import { Box, Avatar, Paper } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import PersonIcon from '@mui/icons-material/Person'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import { StreamingMessage } from './StreamingMessage'

export const ChatMessage = ({ message, isStreaming = false }) => {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  return (
    <Box
      display="flex"
      flexDirection={isUser ? 'row-reverse' : 'row'}
      gap={2}
      mb={2}
      alignItems="flex-start"
    >
      <Avatar
        sx={{
          bgcolor: isUser ? 'primary.main' : 'secondary.main',
          width: 32,
          height: 32
        }}
      >
        {isUser ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
      </Avatar>

      <Paper
        elevation={1}
        sx={{
          p: 2,
          maxWidth: '70%',
          bgcolor: isUser ? 'primary.light' : 'grey.100',
          color: isUser ? 'primary.contrastText' : 'text.primary',
          borderRadius: 2,
          '&:hover': {
            elevation: 2
          }
        }}
      >
        {isAssistant && isStreaming ? (
          <StreamingMessage content={message.content} isStreaming={isStreaming} />
        ) : (
          <BCTypography variant="body1" component="div">
            {message.content}
          </BCTypography>
        )}
      </Paper>
    </Box>
  )
}