import { useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import {
  Box,
  Typography,
  IconButton,
  Divider,
  Alert,
  AlertTitle,
  Button,
  Link,
  Tooltip
} from '@mui/material'
import {
  Close as CloseIcon,
  Chat as ChatIcon,
  Download as DownloadIcon,
  DeleteOutline as DeleteIcon,
  OpenInFull as MaximizeIcon,
  CloseFullscreen as MinimizeIcon
} from '@mui/icons-material'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'

const ChatWindow = ({ onClose, chat, isMaximized, onToggleMaximize }) => {
  const { data: currentUser } = useCurrentUser()
  const messagesContainerRef = useRef(null)
  const scrollTargetRef = useRef(null)
  const lastUserMessageIdRef = useRef(null)
  const wasLoadingRef = useRef(false)

  const quickQuestions = [
    'How do I download an Excel file?',
    'How can I submit an allocation agreement?'
  ]

  const handleDownloadConversation = () => {
    const conversationText = chat.messages
      .map((msg) => {
        const role = msg.role === 'user' ? 'You' : 'Assistant'
        return `${role}:\n${msg.content}\n`
      })
      .join('\n---\n\n')

    const blob = new Blob([conversationText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lcfs-conversation-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleClearConversation = () => {
    chat.clearMessages()
  }

  // Scroll to latest user message when a new one is sent
  useEffect(() => {
    if (chat.messages.length === 0) return

    // Find the last user message
    const lastUserMessage = [...chat.messages]
      .reverse()
      .find((msg) => msg.role === 'user')

    // If there's a new user message, scroll to it
    if (
      lastUserMessage &&
      lastUserMessage.id !== lastUserMessageIdRef.current &&
      scrollTargetRef.current
    ) {
      lastUserMessageIdRef.current = lastUserMessage.id

      // Small delay to ensure DOM is updated
      setTimeout(() => {
        scrollTargetRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
      }, 100)
    }
  }, [chat.messages])

  // Auto-scroll when response finishes loading
  useEffect(() => {
    // Detect when loading finishes
    if (wasLoadingRef.current && !chat.isLoading && scrollTargetRef.current) {
      // Auto-scroll to show user message and response
      setTimeout(() => {
        scrollTargetRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
      }, 100)
    }
    wasLoadingRef.current = chat.isLoading
  }, [chat.isLoading])

  const handleSendMessage = async (content) => {
    await chat.sendMessage(content)
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          py: 0.5,
          px: 1.5,
          bgcolor: '#fcba19',
          color: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="h6"
            component="h1"
            sx={{
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <ChatIcon style={{ minWidth: 22, minHeight: 22 }} />
            </span>
            LCFS Assistant
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Conversation actions */}
          <Tooltip
            title="Download conversation"
            placement="bottom"
            arrow
            disableInteractive
            leaveDelay={0}
          >
            <span>
              <IconButton
                size="small"
                onClick={handleDownloadConversation}
                disabled={chat.messages.length === 0}
                sx={{
                  color: '#000',
                  opacity: chat.messages.length === 0 ? 0.3 : 1,
                  transition: 'background-color 0.2s, opacity 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.08)'
                  },
                  '&:disabled': {
                    opacity: 0.3
                  }
                }}
                aria-label="Download conversation"
              >
                <DownloadIcon style={{ fontSize: 20 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip
            title="Clear conversation"
            placement="bottom"
            arrow
            disableInteractive
            leaveDelay={0}
          >
            <span>
              <IconButton
                size="small"
                onClick={handleClearConversation}
                disabled={chat.messages.length === 0}
                sx={{
                  color: '#000',
                  opacity: chat.messages.length === 0 ? 0.3 : 1,
                  transition: 'background-color 0.2s, opacity 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.08)'
                  },
                  '&:disabled': {
                    opacity: 0.3
                  }
                }}
                aria-label="Clear conversation"
              >
                <DeleteIcon style={{ fontSize: 20 }} />
              </IconButton>
            </span>
          </Tooltip>

          {/* Divider */}
          <Box
            sx={{
              width: '1px',
              height: '20px',
              bgcolor: 'rgba(0, 0, 0, 0.2)',
              mx: 0.5
            }}
          />

          {/* Window controls */}
          <Tooltip
            title={isMaximized ? 'Minimize window' : 'Maximize window'}
            placement="bottom"
            arrow
            disableInteractive
            leaveDelay={0}
          >
            <IconButton
              size="small"
              onClick={(e) => {
                e.currentTarget.blur() // Remove focus to hide tooltip
                onToggleMaximize()
              }}
              sx={{
                color: '#000',
                transition: 'background-color 0.2s',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.08)'
                }
              }}
              aria-label={isMaximized ? 'Minimize window' : 'Maximize window'}
            >
              {isMaximized ? (
                <MinimizeIcon style={{ fontSize: 20 }} />
              ) : (
                <MaximizeIcon style={{ fontSize: 20 }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip
            title="Close assistant"
            placement="bottom"
            arrow
            disableInteractive
            leaveDelay={0}
          >
            <IconButton
              size="small"
              onClick={onClose}
              sx={{
                color: '#000',
                transition: 'background-color 0.2s',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.08)'
                }
              }}
              aria-label="Close chat"
            >
              <CloseIcon style={{ fontSize: 24 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider />

      {/* Messages Area */}
      <Box
        ref={messagesContainerRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 3,
          bgcolor: '#fafafa'
        }}
      >
        {chat.messages.length === 0 && !chat.isLoading && (
          <Box>
            {/* Combined Welcome Box */}
            <Box
              sx={{
                p: 2.5,
                mb: 2,
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                bgcolor: 'white'
              }}
            >
              {/* Greeting */}
              <Typography variant="body1" sx={{ fontSize: '0.95rem', mb: 2 }}>
                Hello{' '}
                <strong>
                  {currentUser?.organization?.name ||
                    `${currentUser?.first_name || 'User'}`}
                </strong>
                ,
              </Typography>

              {/* Assistant Message with Icon */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 2,
                  mb: 2
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ lineHeight: 1.6, flex: 1, fontSize: '0.9rem' }}
                >
                  I can help you with questions about LCFS compliance,
                  reporting, fuel codes, allocation agreements, and navigating
                  the portal. Feel free to ask me anything!
                </Typography>
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: '1.5px solid #000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}
                >
                  ?
                </Box>
              </Box>

              {/* Footer Links */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  justifyContent: 'flex-start',
                  pt: 1.5,
                  borderTop: '1px solid #e0e0e0'
                }}
              >
                <Link
                  href="https://www2.gov.bc.ca/gov/content/home/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                  color="primary"
                  underline="hover"
                  sx={{ fontSize: '0.875rem' }}
                >
                  Privacy
                </Link>
                <Typography variant="body2" color="text.secondary">
                  |
                </Typography>
                <Link
                  href="https://www2.gov.bc.ca/gov/content/home/get-help-with-government-services"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                  color="primary"
                  underline="hover"
                  sx={{ fontSize: '0.875rem' }}
                >
                  Support
                </Link>
              </Box>
            </Box>

            {/* Quick Action Buttons */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {quickQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outlined"
                  sx={{
                    textTransform: 'none',
                    borderRadius: '12px',
                    py: 1,
                    px: 2,
                    border: '1px solid #e0e0e0',
                    color: 'text.primary',
                    fontSize: '0.875rem',
                    justifyContent: 'flex-start',
                    bgcolor: 'white',
                    '&:hover': {
                      bgcolor: '#f5f5f5',
                      borderColor: '#d0d0d0'
                    }
                  }}
                  onClick={() => handleSendMessage(question)}
                >
                  {question}
                </Button>
              ))}
            </Box>
          </Box>
        )}

        {chat.messages
          .filter((message) => message.content && message.content.trim())
          .map((message, index, array) => {
            // Find the last user message and scroll to it
            // This shows the user's question at the top with the AI response below
            const userMessages = array.filter((m) => m.role === 'user')
            const lastUserMessage = userMessages[userMessages.length - 1]
            const isScrollTarget = message === lastUserMessage

            return (
              <Box
                key={index}
                ref={isScrollTarget ? scrollTargetRef : null}
                sx={{
                  scrollMarginTop: '10px'
                }}
              >
                <ChatMessage
                  message={message}
                  onEdit={chat.editMessage}
                  onRegenerate={chat.regenerateResponse}
                />
              </Box>
            )
          })}

        {chat.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>Error</AlertTitle>
            {chat.error}
          </Alert>
        )}
      </Box>

      {/* Loading indicator above input */}
      {chat.isLoading && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            py: 2,
            px: 3,
            bgcolor: '#fafafa',
            borderTop: '1px solid rgba(0, 0, 0, 0.06)'
          }}
        >
          {/* Simple loading indicator */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              px: 2,
              py: 1,
              bgcolor: 'rgba(0, 0, 0, 0.02)',
              borderRadius: '12px',
              border: '1px solid rgba(0, 0, 0, 0.08)'
            }}
          >
            {/* Animated dots */}
            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                '@keyframes dotBounce': {
                  '0%, 60%, 100%': {
                    transform: 'translateY(0)',
                    opacity: 0.4
                  },
                  '30%': {
                    transform: 'translateY(-8px)',
                    opacity: 1
                  }
                }
              }}
            >
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: '#667eea',
                    animation: 'dotBounce 1.4s ease-in-out infinite',
                    animationDelay: `${i * 0.16}s`,
                    willChange: 'transform, opacity'
                  }}
                />
              ))}
            </Box>

            {/* Simple text */}
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.8125rem',
                color: 'text.secondary',
                fontWeight: 500
              }}
            >
              Assistant is thinking...
            </Typography>
          </Box>
        </Box>
      )}

      <Divider />

      {/* Input Area */}
      <ChatInput onSend={handleSendMessage} disabled={chat.isLoading} />
    </Box>
  )
}

ChatWindow.propTypes = {
  onClose: PropTypes.func.isRequired,
  chat: PropTypes.shape({
    messages: PropTypes.array.isRequired,
    isLoading: PropTypes.bool.isRequired,
    error: PropTypes.string,
    sendMessage: PropTypes.func.isRequired,
    editMessage: PropTypes.func,
    regenerateResponse: PropTypes.func,
    clearMessages: PropTypes.func.isRequired
  }).isRequired,
  isMaximized: PropTypes.bool,
  onToggleMaximize: PropTypes.func
}

export default ChatWindow
