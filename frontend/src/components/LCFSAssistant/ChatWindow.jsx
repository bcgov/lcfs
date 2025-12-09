import { useRef, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  Box,
  Typography,
  Divider,
  Alert,
  AlertTitle,
  Button,
  Link,
  useMediaQuery
} from '@mui/material'
import {
  Chat as ChatIcon,
  FileDownload as DownloadIcon,
  RestartAlt as ClearIcon,
  Headset as SupportIcon,
  HelpOutline as HelpIcon
} from '@mui/icons-material'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import EscalationForm from './EscalationForm'
import {
  ChatHeader,
  HeaderIconButton,
  HeaderDivider
} from './components/ChatHeader'

const ChatWindow = ({ onClose, chat, isMaximized, onToggleMaximize }) => {
  const isMobile = useMediaQuery('(max-width: 650px)')
  const { data: currentUser } = useCurrentUser()
  const messagesContainerRef = useRef(null)
  const scrollTargetRef = useRef(null)
  const lastUserMessageIdRef = useRef(null)
  const wasLoadingRef = useRef(false)
  const [showEscalationForm, setShowEscalationForm] = useState(false)
  const [isLowConfidence, setIsLowConfidence] = useState(false)

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

  const handleOpenEscalation = (lowConfidence = false) => {
    setIsLowConfidence(lowConfidence)
    setShowEscalationForm(true)
  }

  const handleCloseEscalation = () => {
    setShowEscalationForm(false)
    setIsLowConfidence(false)
  }

  // Reset escalation form when messages are cleared (widget reopened)
  useEffect(() => {
    if (chat.messages.length === 0) {
      setShowEscalationForm(false)
      setIsLowConfidence(false)
    }
  }, [chat.messages.length])

  // Show escalation form instead of chat
  if (showEscalationForm) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          bgcolor: '#f9fafb'
        }}
      >
        <EscalationForm
          onClose={handleCloseEscalation}
          onCloseWidget={onClose}
          conversationHistory={chat.messages}
          isLowConfidence={isLowConfidence}
          isMaximized={isMaximized}
          onToggleMaximize={onToggleMaximize}
          isMobile={isMobile}
        />
      </Box>
    )
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
      <ChatHeader
        title="LCFS Assistant"
        icon={ChatIcon}
        bgcolor="#fcba19"
        isMaximized={isMaximized}
        isMobile={isMobile}
        onToggleMaximize={onToggleMaximize}
        onClose={onClose}
        rightActions={
          chat.messages.length > 0 && (
            <>
              <HeaderIconButton
                icon={DownloadIcon}
                onClick={handleDownloadConversation}
                tooltip="Download conversation"
                ariaLabel="Download conversation"
              />
              <HeaderIconButton
                icon={ClearIcon}
                onClick={handleClearConversation}
                tooltip="Clear conversation"
                ariaLabel="Clear conversation"
              />
              <HeaderDivider />
            </>
          )
        }
      />

      <Divider sx={{ borderColor: '#e5e7eb' }} />

      {/* Messages Area */}
      <Box
        ref={messagesContainerRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          scrollBehavior: 'smooth',
          p: 3,
          bgcolor: '#f9fafb'
        }}
      >
        {chat.messages.length === 0 && !chat.isLoading && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              minHeight: '100%'
            }}
          >
            {/* Combined Welcome Box */}
            <Box
              sx={{
                p: 2.5,
                mb: 2,
                borderRadius: '8px',
                bgcolor: '#ffffff',
                border: '1px solid #d1d5db'
              }}
            >
              {/* Greeting */}
              <Typography
                variant="body1"
                sx={{
                  fontSize: '0.95rem',
                  mb: 1.5,
                  color: '#1f2937'
                }}
              >
                Hello{' '}
                <strong>
                  {currentUser?.organization?.name ||
                    `${currentUser?.first_name || 'User'}`}
                </strong>
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
                  sx={{
                    lineHeight: 1.6,
                    flex: 1,
                    fontSize: '0.875rem',
                    color: '#4b5563'
                  }}
                >
                  I can assist you with questions about LCFS compliance,
                  reporting, fuel codes, allocation agreements, and navigating
                  the portal.
                </Typography>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: '#003366',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    mt: -3
                  }}
                >
                  ?
                </Box>
              </Box>

              {/* Footer Links */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  justifyContent: 'flex-start',
                  pt: 1.5,
                  borderTop: '1px solid #e5e7eb'
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
                  component="button"
                  variant="body2"
                  color="primary"
                  underline="none"
                  onClick={() => handleOpenEscalation(false)}
                  sx={{
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  Support
                </Link>
              </Box>
            </Box>

            {/* Quick Action Buttons - Stuck to bottom */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
                mt: 'auto'
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#6b7280',
                  mb: 0.5,
                  fontSize: '0.75rem',
                  fontWeight: 500
                }}
              >
                Suggested questions
              </Typography>
              {quickQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="text"
                  sx={{
                    textTransform: 'none',
                    borderRadius: '6px',
                    py: 1,
                    px: 1.5,
                    border: '1px solid #d1d5db',
                    color: '#1f2937',
                    fontSize: '0.8125rem',
                    justifyContent: 'flex-start',
                    bgcolor: '#ffffff',
                    fontWeight: 400,
                    lineHeight: 1.4,
                    textAlign: 'left',
                    '&:hover': {
                      bgcolor: '#f9fafb',
                      borderColor: '#9ca3af'
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
            const isLastAssistantMessage =
              message.role === 'assistant' && index === array.length - 1

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
                {/* Show "Not helpful?" option after the last assistant message */}
                {isLastAssistantMessage && !chat.isLoading && (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-start',
                      mt: 1.5,
                      mb: 2
                    }}
                  >
                    <Button
                      variant="text"
                      startIcon={<SupportIcon style={{ fontSize: 18 }} />}
                      onClick={() => handleOpenEscalation(true)}
                      sx={{
                        textTransform: 'none',
                        borderRadius: '6px',
                        py: 1,
                        px: 1.5,
                        border: '1px solid #d1d5db',
                        color: '#1f2937',
                        fontSize: '0.8125rem',
                        bgcolor: '#ffffff',
                        fontWeight: 400,
                        '& .MuiButton-startIcon': {
                          mr: 0.5
                        },
                        '&:hover': {
                          bgcolor: '#f9fafb',
                          borderColor: '#9ca3af'
                        }
                      }}
                    >
                      Not helpful? Contact support
                    </Button>
                  </Box>
                )}
              </Box>
            )
          })}

        {/* Loading indicator while AI is generating response */}
        {chat.isLoading && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              mb: 2
            }}
          >
            {/* Role label */}
            <Box sx={{ px: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: '#606060',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Assistant
              </Typography>
            </Box>

            {/* Loading box */}
            <Box
              sx={{
                px: 2.5,
                py: 2,
                borderRadius: '4px',
                borderLeft: '4px solid #003366',
                background: '#ffffff',
                border: '1px solid #e8e8e8',
                maxWidth: '85%'
              }}
            >
              {/* Typing indicator */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    gap: 0.5,
                    alignItems: 'center'
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: '#003366',
                        animation: `loadingBounce 1.4s ease-in-out ${i * 0.16}s infinite`,
                        '@keyframes loadingBounce': {
                          '0%, 80%, 100%': {
                            transform: 'scale(0.6)',
                            opacity: 0.4
                          },
                          '40%': {
                            transform: 'scale(1)',
                            opacity: 1
                          }
                        }
                      }}
                    />
                  ))}
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#606060',
                    fontSize: '0.875rem',
                    ml: 0.5
                  }}
                >
                  Generating response...
                </Typography>
              </Box>

              {/* Skeleton lines for content preview */}
              <Box
                sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}
              >
                {[100, 85, 70].map((width, i) => (
                  <Box
                    key={i}
                    sx={{
                      height: 12,
                      width: `${width}%`,
                      borderRadius: '4px',
                      background:
                        'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                      backgroundSize: '200% 100%',
                      animation: `shimmer 1.5s ease-in-out ${i * 0.1}s infinite`,
                      '@keyframes shimmer': {
                        '0%': { backgroundPosition: '200% 0' },
                        '100%': { backgroundPosition: '-200% 0' }
                      }
                    }}
                  />
                ))}
              </Box>

              {/* Skeleton for references */}
              <Box
                sx={{
                  mt: 2.5,
                  pt: 2,
                  borderTop: '1px solid #e8e8e8'
                }}
              >
                <Box
                  sx={{
                    height: 10,
                    width: 80,
                    borderRadius: '4px',
                    bgcolor: '#e8e8e8',
                    mb: 1.5
                  }}
                />
                {[1, 2].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 0.75,
                      pl: 1.25,
                      borderLeft: '2px solid #e0e0e0'
                    }}
                  >
                    <Box
                      sx={{
                        height: 10,
                        width: `${65 - i * 10}%`,
                        borderRadius: '4px',
                        background:
                          'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                        backgroundSize: '200% 100%',
                        animation: `shimmer 1.5s ease-in-out ${0.3 + i * 0.1}s infinite`
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}

        {chat.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>Error</AlertTitle>
            {chat.error}
          </Alert>
        )}
      </Box>

      <Divider sx={{ borderColor: '#e5e7eb' }} />

      {/* Input Area */}
      <ChatInput onSend={handleSendMessage} disabled={chat.isLoading} />

      {/* Footer with disclaimer */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 1,
          px: 2,
          bgcolor: '#f9fafb',
          borderTop: '1px solid #e5e7eb'
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: '#6b7280',
            fontSize: '0.6rem',
            textAlign: 'center',
            fontWeight: 600
          }}
        >
          AI-generated responses may be inaccurate. Please verify important
          information.
        </Typography>
      </Box>
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
