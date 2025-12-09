import React, { useState } from 'react'
import {
  Box,
  Paper,
  Container,
  Toolbar,
  IconButton,
  Divider
} from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import { useChat } from '@/hooks/useChat'
import { ChatMessages } from './components/ChatMessages'
import { ChatInput } from './components/ChatInput'

export const Chat = () => {
  const [input, setInput] = useState('')
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages
  } = useChat()

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return

    const messageContent = input.trim()
    setInput('') // Clear input immediately for better UX
    await sendMessage(messageContent)
  }

  const handleStop = () => {
    stopStreaming()
  }

  const handleClear = () => {
    clearMessages()
  }

  return (
    <Container
      maxWidth="lg"
      sx={{ py: 3, height: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <Paper
        elevation={2}
        sx={{
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'background.paper'
        }}
      >
        {/* Header */}
        <Toolbar
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            minHeight: '64px !important'
          }}
        >
          <BCTypography
            variant="h6"
            component="h1"
            sx={{ flexGrow: 1, color: 'inherit' }}
          >
            LCFS Assistant
          </BCTypography>

          {messages.length > 0 && (
            <BCButton
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<ClearIcon />}
              onClick={handleClear}
              disabled={isStreaming}
              sx={{
                color: 'primary.contrastText',
                borderColor: 'primary.contrastText',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'primary.contrastText'
                }
              }}
            >
              Clear Chat
            </BCButton>
          )}
        </Toolbar>

        <Divider />

        {/* Messages Area */}
        <ChatMessages
          messages={messages}
          isStreaming={isStreaming}
          error={error}
        />

        <Divider />

        {/* Input Area */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={handleStop}
          disabled={false}
          isStreaming={isStreaming}
        />
      </Paper>

      {/* Footer */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <BCTypography variant="caption" color="textSecondary">
          LCFS Assistant can help with accounting, compliance, and regulatory
          questions. Information may not always be accurate.
        </BCTypography>
      </Box>
    </Container>
  )
}
