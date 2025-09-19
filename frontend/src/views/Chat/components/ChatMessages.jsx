import React, { useEffect, useRef } from 'react'
import { Box, Alert } from '@mui/material'
import { ChatMessage } from './ChatMessage'
import BCTypography from '@/components/BCTypography'

export const ChatMessages = ({
  messages = [],
  isStreaming = false,
  error = null
}) => {
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      })
    }
  }, [messages, isStreaming])

  const renderWelcomeMessage = () => (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="100%"
      textAlign="center"
      p={4}
    >
      <BCTypography variant="h5" gutterBottom color="primary">
        LCFS Assistant
      </BCTypography>
      <BCTypography variant="body1" color="textSecondary" sx={{ maxWidth: 500 }}>
        Ask me questions about accounting principles, LCFS regulations, compliance reporting,
        or any other topics related to the Low Carbon Fuel Standard program.
      </BCTypography>
    </Box>
  )

  const renderMessages = () => (
    <Box sx={{ p: 2, flexGrow: 1 }}>
      {messages.map((message, index) => {
        const isLastAssistantMessage =
          index === messages.length - 1 && message.role === 'assistant'

        return (
          <ChatMessage
            key={`${message.role}-${index}`}
            message={message}
            isStreaming={isStreaming && isLastAssistantMessage}
          />
        )
      })}


      <div ref={messagesEndRef} />
    </Box>
  )

  return (
    <Box
      ref={messagesContainerRef}
      sx={{
        flexGrow: 1,
        overflow: 'auto',
        height: '100%',
        bgcolor: 'background.default',
        '&::-webkit-scrollbar': {
          width: '8px'
        },
        '&::-webkit-scrollbar-track': {
          bgcolor: 'transparent'
        },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'grey.300',
          borderRadius: '4px',
          '&:hover': {
            bgcolor: 'grey.400'
          }
        }
      }}
    >
      {error && (
        <Box p={2}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        </Box>
      )}

      {messages.length === 0 ? renderWelcomeMessage() : renderMessages()}
    </Box>
  )
}