import { useState, useEffect, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  TextField,
  Button
} from '@mui/material'
import {
  VolumeUp as VolumeUpIcon,
  Stop as StopIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material'
import { useVoice } from '@/hooks/useVoice'
import { copyToClipboard } from '@/utils/clipboard'

const stripTrailingSources = (content = '') => {
  const marker = '\nsources:'
  const lowerContent = content.toLowerCase()
  const lastIdx = lowerContent.lastIndexOf(marker)

  if (lastIdx === -1) {
    return content
  }

  return content.slice(0, lastIdx).trimEnd()
}

// Track which messages have been animated (persists across re-mounts)
const animatedMessages = new Set()

const ChatMessage = ({ message, onEdit, onRegenerate }) => {
  const isUser = message.role === 'user'
  const voice = useVoice()
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(message.content)
  const [showCopySuccess, setShowCopySuccess] = useState(false)
  const editInputRef = useRef(null)
  const citationList = message.metadata?.citations || message.sources || []
  const displayContent = useMemo(
    () => stripTrailingSources(message.content),
    [message.content]
  )
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Check if this message has already been animated - capture at mount time
  const messageKey = `${message.id}-${message.role}`
  const wasAlreadyAnimatedRef = useRef(animatedMessages.has(messageKey))
  const alreadyAnimated = wasAlreadyAnimatedRef.current

  const [visibleChars, setVisibleChars] = useState(
    alreadyAnimated ? displayContent.length : 0
  )
  const [showSources, setShowSources] = useState(alreadyAnimated)

  // Should we animate? Only if this is a fresh message
  const shouldAnimateRefs = !alreadyAnimated && !prefersReducedMotion

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return
    }
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = (event) => {
      setPrefersReducedMotion(event.matches)
    }

    setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', updatePreference)

    return () => {
      mediaQuery.removeEventListener('change', updatePreference)
    }
  }, [])

  // Progressive text reveal for assistant messages - only on first appearance
  useEffect(() => {
    // Skip animation if: user message, editing, reduced motion, or already animated
    if (isUser || isEditing || prefersReducedMotion || alreadyAnimated) {
      setVisibleChars(displayContent.length)
      setShowSources(true)
      animatedMessages.add(messageKey)
      return
    }

    setVisibleChars(0)
    setShowSources(false)

    const charsPerTick = 3 // Characters to reveal per tick
    const tickInterval = 15 // Milliseconds between ticks

    const totalChars = displayContent.length
    let currentChars = 0

    const timer = setInterval(() => {
      currentChars += charsPerTick
      if (currentChars >= totalChars) {
        setVisibleChars(totalChars)
        setShowSources(true)
        animatedMessages.add(messageKey) // Mark as animated globally
        clearInterval(timer)
      } else {
        setVisibleChars(currentChars)
      }
    }, tickInterval)

    return () => clearInterval(timer)
  }, [
    displayContent,
    isUser,
    isEditing,
    prefersReducedMotion,
    alreadyAnimated,
    messageKey
  ])

  // Set cursor to end when editing starts
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      const input = editInputRef.current
      const length = input.value.length
      input.setSelectionRange(length, length)
    }
  }, [isEditing])

  const handleSpeak = () => {
    if (voice.isSpeaking) {
      voice.stopSpeaking()
    } else {
      voice.speak(displayContent || message.content)
    }
  }

  const handleEditClick = () => {
    setIsEditing(true)
    setEditedContent(message.content)
  }

  const handleSaveEdit = () => {
    if (editedContent.trim() && editedContent !== message.content) {
      onEdit(message.id, editedContent.trim())
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedContent(message.content)
  }

  const handleCopy = async () => {
    const success = await copyToClipboard(displayContent || message.content)
    if (success) {
      setShowCopySuccess(true)
    }
  }

  // Auto-hide copy success notification after 2 seconds
  useEffect(() => {
    if (showCopySuccess) {
      const timer = setTimeout(() => {
        setShowCopySuccess(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [showCopySuccess])

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(message.id)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 2
      }}
    >
      <Box
        sx={{
          maxWidth: isEditing ? '95%' : '85%',
          minWidth: isEditing ? '70%' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5
        }}
      >
        {/* Role label with voice button for assistant */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1
          }}
        >
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
            {isUser ? 'You' : 'Assistant'}
          </Typography>
          {isUser && onEdit && !isEditing && (
            <Tooltip title="Edit message" disableInteractive leaveDelay={0}>
              <IconButton
                onClick={handleEditClick}
                size="small"
                aria-label="Edit message"
                sx={{
                  p: 0.5,
                  color: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    color: '#1f2937',
                    bgcolor: 'rgba(0, 0, 0, 0.06)'
                  }
                }}
              >
                <EditIcon sx={{ fontSize: '0.875rem' }} />
              </IconButton>
            </Tooltip>
          )}
          {!isUser && voice.isSupported && (
            <Tooltip
              title={
                voice.isSpeaking ? 'Stop speaking' : 'Listen to this response'
              }
              disableInteractive
              leaveDelay={0}
            >
              <IconButton
                onClick={handleSpeak}
                size="small"
                aria-label={
                  voice.isSpeaking ? 'Stop speaking' : 'Listen to response'
                }
                sx={{
                  p: 0.5,
                  bgcolor: voice.isSpeaking
                    ? 'rgba(211, 47, 47, 0.1)'
                    : 'transparent',
                  color: voice.isSpeaking ? '#d32f2f' : 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  animation: voice.isSpeaking
                    ? 'speaking 1.5s ease-in-out infinite'
                    : 'none',
                  '@keyframes speaking': {
                    '0%, 100%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.05)' }
                  },
                  '&:hover': {
                    bgcolor: voice.isSpeaking
                      ? 'rgba(211, 47, 47, 0.15)'
                      : 'rgba(0, 0, 0, 0.06)',
                    color: voice.isSpeaking ? '#c62828' : '#1f2937'
                  }
                }}
              >
                {voice.isSpeaking ? (
                  <StopIcon sx={{ fontSize: '0.875rem' }} />
                ) : (
                  <VolumeUpIcon sx={{ fontSize: '0.875rem' }} />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Minimal message box */}
        <Box
          sx={{
            px: 2.5,
            py: 2,
            color: '#313132',
            borderRadius: '4px',
            borderLeft: isUser ? '3px solid #5091cd' : '4px solid #003366',
            background: isUser ? '#eef2f7' : '#ffffff',
            border: isUser ? '1px solid #d8dfe6' : '1px solid #e8e8e8',
            transition: 'all 0.2s ease',
            opacity: prefersReducedMotion || alreadyAnimated ? 1 : 0,
            animation:
              prefersReducedMotion || alreadyAnimated
                ? 'none'
                : 'messageSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            '@keyframes messageSlideIn': {
              '0%': {
                opacity: 0,
                transform: 'translateY(8px)'
              },
              '100%': {
                opacity: 1,
                transform: 'translateY(0)'
              }
            }
          }}
        >
          {isEditing ? (
            <Box
              sx={{
                width: '100%',
                bgcolor: '#ffffff',
                borderRadius: '8px',
                p: 1.5,
                border: '1px solid #d1d5db'
              }}
            >
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={8}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleCancelEdit()
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (
                      editedContent.trim() &&
                      editedContent !== message.content
                    ) {
                      handleSaveEdit()
                    }
                  }
                }}
                autoFocus
                inputRef={editInputRef}
                placeholder="Edit your message..."
                variant="standard"
                InputProps={{
                  disableUnderline: true
                }}
                sx={{
                  '& .MuiInputBase-root': {
                    fontSize: '0.9375rem',
                    lineHeight: 1.6,
                    p: 0
                  },
                  '& .MuiInputBase-input': {
                    p: 0
                  }
                }}
              />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  mt: 1.5,
                  pt: 1.5,
                  gap: 1,
                  borderTop: '1px solid #d1d5db'
                }}
              >
                <Button
                  size="small"
                  onClick={handleCancelEdit}
                  sx={{
                    textTransform: 'none',
                    color: '#4b5563',
                    fontSize: '0.8rem',
                    minWidth: 'auto',
                    px: 1.5,
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.06)',
                      color: '#1f2937'
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSaveEdit}
                  disabled={
                    !editedContent.trim() || editedContent === message.content
                  }
                  sx={{
                    textTransform: 'none',
                    bgcolor: '#003366',
                    color: '#fff',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    px: 2,
                    boxShadow: 'none',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: '#002244',
                      boxShadow: 'none'
                    },
                    '&.Mui-disabled': {
                      bgcolor: '#d1d5db',
                      color: '#6b7280',
                      cursor: 'not-allowed'
                    }
                  }}
                >
                  Update
                </Button>
              </Box>
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  fontSize: '0.9375rem',
                  lineHeight: 1.7,
                  color: '#313132',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  minHeight: '1.7em',
                  position: 'relative',
                  maxWidth: '100%',
                  overflow: 'hidden'
                }}
              >
                {isUser || prefersReducedMotion
                  ? displayContent
                  : displayContent.slice(0, visibleChars)}
                {!isUser &&
                  !prefersReducedMotion &&
                  visibleChars < displayContent.length && (
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-block',
                        width: '2px',
                        height: '1em',
                        bgcolor: '#003366',
                        ml: 0.5,
                        animation: 'cursorBlink 1s step-end infinite',
                        '@keyframes cursorBlink': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0 }
                        }
                      }}
                    />
                  )}
              </Box>

              {citationList.length > 0 && showSources && (
                <Box
                  sx={{
                    mt: 2.5,
                    pt: 2,
                    borderTop: '1px solid #e0e0e0',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    animation: shouldAnimateRefs
                      ? 'refsContainerIn 0.5s ease-out both'
                      : 'none',
                    '@keyframes refsContainerIn': {
                      '0%': { opacity: 0, transform: 'translateY(12px)' },
                      '100%': { opacity: 1, transform: 'translateY(0)' }
                    }
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.6875rem',
                      color: '#606060',
                      display: 'block',
                      mb: 1,
                      textTransform: 'uppercase',
                      letterSpacing: '0.8px',
                      animation: shouldAnimateRefs
                        ? 'refsLabelIn 0.4s ease-out 0.1s both'
                        : 'none',
                      '@keyframes refsLabelIn': {
                        '0%': { opacity: 0, transform: 'translateX(-8px)' },
                        '100%': { opacity: 1, transform: 'translateX(0)' }
                      }
                    }}
                  >
                    References
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.75,
                      maxWidth: '100%',
                      overflow: 'hidden'
                    }}
                  >
                    {citationList.map((source, idx) => {
                      const link = source.url || source.origin
                      return (
                        <Box
                          key={idx}
                          sx={{
                            pl: 1.25,
                            borderLeft: '2px solid #003366',
                            py: 0.25,
                            maxWidth: '100%',
                            overflow: 'hidden',
                            animation: shouldAnimateRefs
                              ? `refsItemIn 0.4s ease-out ${0.2 + idx * 0.12}s both`
                              : 'none',
                            '@keyframes refsItemIn': {
                              '0%': {
                                opacity: 0,
                                transform: 'translateX(-15px)'
                              },
                              '100%': { opacity: 1, transform: 'translateX(0)' }
                            }
                          }}
                        >
                          <Typography
                            variant="caption"
                            component={link ? 'a' : 'span'}
                            href={link || undefined}
                            target={link ? '_blank' : undefined}
                            rel={link ? 'noopener noreferrer' : undefined}
                            sx={{
                              fontSize: '0.8125rem',
                              color: link ? '#1a5a96' : '#313132',
                              display: 'block',
                              textDecoration: 'none',
                              fontWeight: 400,
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                              maxWidth: '100%',
                              transition: 'color 0.2s ease',
                              '&:hover': link
                                ? {
                                    color: '#003366',
                                    textDecoration: 'underline'
                                  }
                                : {}
                            }}
                          >
                            {source.title || 'LCFS Reference Document'}
                          </Typography>
                          {typeof source.score === 'number' && (
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: '0.6875rem',
                                color: '#909090',
                                display: 'block',
                                mt: 0.25
                              }}
                            >
                              Relevance: {(source.score * 100).toFixed(0)}%
                            </Typography>
                          )}
                        </Box>
                      )
                    })}
                  </Box>
                </Box>
              )}
            </>
          )}

          {/* Action buttons for assistant messages */}
          {!isUser && !isEditing && message.content && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mt: 1.5,
                pt: 1,
                borderTop: '1px solid #e5e7eb'
              }}
            >
              <Tooltip
                title={showCopySuccess ? 'Copied!' : 'Copy to clipboard'}
                placement="top"
                arrow
                disableInteractive
                leaveDelay={0}
              >
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  sx={{
                    p: 0.5,
                    color: showCopySuccess ? '#16a34a' : 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.06)',
                      color: showCopySuccess ? '#16a34a' : '#1f2937'
                    }
                  }}
                >
                  {showCopySuccess ? (
                    <CheckCircleIcon sx={{ fontSize: '0.875rem' }} />
                  ) : (
                    <CopyIcon sx={{ fontSize: '0.875rem' }} />
                  )}
                </IconButton>
              </Tooltip>

              <Tooltip
                title="Regenerate response"
                placement="top"
                arrow
                disableInteractive
                leaveDelay={0}
              >
                <IconButton
                  size="small"
                  onClick={handleRegenerate}
                  sx={{
                    p: 0.5,
                    color: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.06)',
                      color: '#1f2937'
                    }
                  }}
                >
                  <RefreshIcon sx={{ fontSize: '0.875rem' }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}

ChatMessage.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    role: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    sources: PropTypes.array,
    metadata: PropTypes.shape({
      citations: PropTypes.arrayOf(
        PropTypes.shape({
          title: PropTypes.string,
          url: PropTypes.string,
          origin: PropTypes.string,
          score: PropTypes.number
        })
      )
    })
  }).isRequired,
  onEdit: PropTypes.func,
  onRegenerate: PropTypes.func
}

export default ChatMessage
