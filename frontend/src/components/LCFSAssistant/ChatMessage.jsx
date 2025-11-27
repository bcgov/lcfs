import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Box, Typography, IconButton, Tooltip, TextField } from '@mui/material'
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

const ChatMessage = ({ message, onEdit, onRegenerate }) => {
  const isUser = message.role === 'user'
  const voice = useVoice()
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(message.content)
  const [showCopySuccess, setShowCopySuccess] = useState(false)

  const handleSpeak = () => {
    if (voice.isSpeaking) {
      voice.stopSpeaking()
    } else {
      voice.speak(message.content)
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
    const success = await copyToClipboard(message.content)
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
        mb: 2.5
      }}
    >
      <Box
        sx={{
          maxWidth: '80%',
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
            px: 1.5
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 500,
              color: 'text.secondary'
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
                  color: '#666',
                  opacity: 0.7,
                  transition: 'opacity 0.2s, background-color 0.2s',
                  '&:hover': {
                    opacity: 1,
                    bgcolor: 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                <EditIcon sx={{ fontSize: '0.9rem' }} />
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
                  color: voice.isSpeaking ? '#d32f2f' : '#666',
                  border: voice.isSpeaking
                    ? '1px solid rgba(211, 47, 47, 0.2)'
                    : '1px solid transparent',
                  borderRadius: '6px',
                  transition:
                    'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
                  animation: voice.isSpeaking
                    ? 'speaking 1.5s ease-in-out infinite'
                    : 'none',
                  '@keyframes speaking': {
                    '0%, 100%': {
                      transform: 'scale(1)'
                    },
                    '50%': {
                      transform: 'scale(1.1)'
                    }
                  },
                  '&:hover': {
                    bgcolor: voice.isSpeaking
                      ? 'rgba(211, 47, 47, 0.15)'
                      : 'rgba(0, 0, 0, 0.06)',
                    color: voice.isSpeaking ? '#c62828' : '#333'
                  }
                }}
              >
                {voice.isSpeaking ? (
                  <StopIcon sx={{ fontSize: '1.1rem' }} />
                ) : (
                  <VolumeUpIcon sx={{ fontSize: '1.1rem' }} />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Clean message bubble */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: isUser ? 'rgba(0, 51, 102, 0.06)' : 'white',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: isUser
              ? 'rgba(0, 51, 102, 0.12)'
              : 'rgba(0, 0, 0, 0.08)',
            boxShadow: isUser ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.04)'
          }}
        >
          {isEditing ? (
            <>
              <TextField
                fullWidth
                multiline
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                autoFocus
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '0.9375rem',
                    lineHeight: 1.6,
                    '& fieldset': {
                      borderColor: '#1976d2'
                    }
                  }
                }}
              />
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  mt: 1.5,
                  justifyContent: 'flex-end'
                }}
              >
                <IconButton
                  size="small"
                  onClick={handleCancelEdit}
                  sx={{
                    color: '#666',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.04)'
                    }
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleSaveEdit}
                  disabled={!editedContent.trim()}
                  sx={{
                    color: '#1976d2',
                    '&:hover': {
                      bgcolor: 'rgba(25, 118, 210, 0.08)'
                    },
                    '&:disabled': {
                      color: '#ccc'
                    }
                  }}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
              </Box>
            </>
          ) : (
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                color: 'text.primary'
              }}
            >
              {message.content}
            </Typography>
          )}

          {message.sources && message.sources.length > 0 && (
            <Box
              sx={{
                mt: 2,
                pt: 1.5,
                borderTop: '1px solid rgba(0, 0, 0, 0.06)'
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  display: 'block',
                  mb: 1
                }}
              >
                Sources:
              </Typography>
              {message.sources.map((source, idx) => (
                <Box key={idx} sx={{ mb: 0.75 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.8125rem',
                      color: 'text.primary',
                      display: 'block'
                    }}
                  >
                    • {source.title}
                  </Typography>
                  {source.lastUpdated && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        display: 'block',
                        ml: 1.5
                      }}
                    >
                      {new Date(source.lastUpdated).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Action buttons for assistant messages */}
          {!isUser && !isEditing && message.content && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                mt: 1.5,
                pt: 1,
                borderTop: '1px solid rgba(0, 0, 0, 0.04)'
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
                    p: 0.75,
                    color: showCopySuccess ? '#4caf50' : '#666',
                    borderRadius: '8px',
                    transition: 'background-color 0.2s, color 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.06)',
                      color: showCopySuccess ? '#4caf50' : '#1976d2'
                    }
                  }}
                >
                  {showCopySuccess ? (
                    <CheckCircleIcon sx={{ fontSize: '1rem' }} />
                  ) : (
                    <CopyIcon sx={{ fontSize: '1rem' }} />
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
                    p: 0.75,
                    color: '#666',
                    borderRadius: '8px',
                    transition: 'background-color 0.2s, color 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.06)',
                      color: '#1976d2'
                    }
                  }}
                >
                  <RefreshIcon sx={{ fontSize: '1rem' }} />
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
    sources: PropTypes.array
  }).isRequired,
  onEdit: PropTypes.func,
  onRegenerate: PropTypes.func
}

export default ChatMessage
