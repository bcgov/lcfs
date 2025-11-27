import { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { Box, TextField, IconButton, Tooltip, Typography } from '@mui/material'
import {
  Send as SendIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon
} from '@mui/icons-material'
import { useVoice } from '@/hooks/useVoice'

const ChatInput = ({ onSend, disabled }) => {
  const [input, setInput] = useState('')
  const maxLength = 500
  const voice = useVoice()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleChange = (e) => {
    const value = e.target.value
    if (value.length <= maxLength) {
      setInput(value)
    }
  }

  // Update input when voice transcript changes
  useEffect(() => {
    if (voice.transcript && voice.transcript.trim()) {
      const fullTranscript =
        voice.transcript +
        (voice.interimTranscript ? ' ' + voice.interimTranscript : '')
      setInput(fullTranscript.slice(0, maxLength))
    } else if (voice.interimTranscript) {
      setInput(voice.interimTranscript.slice(0, maxLength))
    }
  }, [voice.transcript, voice.interimTranscript, maxLength])

  // Detect when voice recognition stops and send immediately
  const wasListeningRef = useRef(false)
  useEffect(() => {
    if (
      wasListeningRef.current &&
      !voice.isListening &&
      input.trim() &&
      !disabled
    ) {
      // User was listening and now stopped - send immediately
      setTimeout(() => {
        onSend(input.trim())
        setInput('')
      }, 800) // Brief delay to ensure transcript is complete
    }
    wasListeningRef.current = voice.isListening
  }, [voice.isListening, input, disabled, onSend])

  // Handle microphone button click
  const handleMicClick = () => {
    if (voice.isListening) {
      voice.stopListening()
    } else {
      setInput('') // Clear input when starting to listen
      voice.startListening()
    }
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        p: 2
      }}
    >
      {/* Voice recording indicator */}
      {voice.isListening && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            mb: 1,
            bgcolor: 'rgba(211, 47, 47, 0.08)',
            borderRadius: '12px',
            border: '1px solid rgba(211, 47, 47, 0.2)'
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: '#d32f2f',
              animation: 'pulse 1.5s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': {
                  opacity: 1,
                  transform: 'scale(1)'
                },
                '50%': {
                  opacity: 0.5,
                  transform: 'scale(1.2)'
                }
              }
            }}
          />
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.875rem',
              color: '#d32f2f',
              fontWeight: 500
            }}
          >
            Listening... {voice.interimTranscript && '(processing)'}
          </Typography>
        </Box>
      )}

      <Box sx={{ position: 'relative' }}>
        <TextField
          fullWidth
          multiline
          minRows={3}
          maxRows={4}
          placeholder={
            voice.isListening
              ? 'Speak now...'
              : 'Ask a question or click the microphone'
          }
          value={input}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          disabled={disabled || voice.isListening}
          aria-label="Chat message input"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '16px',
              bgcolor: voice.isListening ? 'rgba(211, 47, 47, 0.02)' : 'white',
              fontSize: '0.9rem',
              paddingBottom: '32px',
              transition: 'all 0.3s ease',
              '& fieldset': {
                borderColor: voice.isListening ? '#d32f2f' : '#666',
                transition: 'border-color 0.3s ease'
              },
              '&:hover fieldset': {
                borderColor: voice.isListening ? '#d32f2f' : '#666'
              },
              '&.Mui-focused fieldset': {
                borderColor: '#999'
              }
            }
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            left: 14,
            bottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: 'calc(100% - 28px)'
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.75rem',
              color: '#999'
            }}
          >
            {input.length} / {maxLength}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {voice.isSupported && (
              <Tooltip
                title={
                  voice.isListening
                    ? 'Stop recording (auto-stops after silence)'
                    : 'Start voice input'
                }
              >
                <span>
                  <IconButton
                    onClick={handleMicClick}
                    disabled={disabled}
                    aria-label={
                      voice.isListening ? 'Stop recording' : 'Start voice input'
                    }
                    sx={{
                      p: 0.75,
                      bgcolor: voice.isListening
                        ? 'rgba(211, 47, 47, 0.1)'
                        : 'transparent',
                      color: voice.isListening ? '#d32f2f' : '#666',
                      border: voice.isListening
                        ? '1px solid rgba(211, 47, 47, 0.3)'
                        : '1px solid transparent',
                      borderRadius: '8px',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: voice.isListening
                          ? 'rgba(211, 47, 47, 0.15)'
                          : 'rgba(0, 0, 0, 0.04)',
                        color: voice.isListening ? '#c62828' : '#333',
                        transform: 'scale(1.05)'
                      },
                      '&:disabled': {
                        color: '#ccc',
                        bgcolor: 'transparent',
                        border: '1px solid transparent'
                      }
                    }}
                    size="small"
                  >
                    {voice.isListening ? (
                      <MicOffIcon fontSize="small" />
                    ) : (
                      <MicIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Tooltip title="Send message">
              <span>
                <IconButton
                  type="submit"
                  disabled={!input.trim() || disabled}
                  aria-label="Send message"
                  sx={{
                    p: 0.5,
                    color: input.trim() && !disabled ? '#666' : '#ccc',
                    '&:hover': {
                      bgcolor: 'transparent',
                      color: input.trim() && !disabled ? '#333' : '#ccc'
                    },
                    '&:disabled': {
                      color: '#ccc'
                    }
                  }}
                  size="small"
                >
                  <SendIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

ChatInput.propTypes = {
  onSend: PropTypes.func.isRequired,
  disabled: PropTypes.bool
}

export default ChatInput
