import { useState } from 'react'
import PropTypes from 'prop-types'
import { Fab, Paper, Fade, Box, useTheme, useMediaQuery } from '@mui/material'
import { Chat as ChatIcon, Close as CloseIcon } from '@mui/icons-material'
import ChatWindow from './ChatWindow'
import { useChatAssistant } from '@/hooks/useChatAssistant'

const ChatWidget = () => {
  const [open, setOpen] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const chat = useChatAssistant()

  const handleToggle = () => {
    setOpen(!open)
    if (!open) {
      // Reset chat when opening
      chat.clearMessages()
      setIsMaximized(false) // Reset to normal size when closing
    }
  }

  return (
    <>
      {/* Chat Window */}
      <Fade in={open}>
        <Box
          sx={{
            position: 'fixed',
            bottom: isMobile ? 0 : 150,
            right: isMobile ? 0 : 24,
            width: isMobile ? '100%' : isMaximized ? 550 : 400,
            height: isMobile ? '100vh' : isMaximized ? '85vh' : 600,
            maxHeight: isMobile
              ? '100vh'
              : isMaximized
                ? '90vh'
                : 'calc(100vh - 190px)',
            display: open ? 'flex' : 'none',
            zIndex: 1300,
            borderRadius: isMobile ? 0 : '12px',
            transition: 'width 0.3s ease, height 0.3s ease'
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: isMobile ? 0 : '10.5px',
              overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
              bgcolor: 'background.paper'
            }}
          >
            <ChatWindow
              onClose={handleToggle}
              chat={chat}
              isMaximized={isMaximized}
              onToggleMaximize={() => setIsMaximized(!isMaximized)}
            />
          </Paper>
        </Box>
      </Fade>

      {/* Floating Action Button */}
      <Fab
        variant="extended"
        aria-label={open ? 'Close LCFS Assistant' : 'Open LCFS Assistant'}
        sx={{
          position: 'fixed',
          bottom: 80,
          right: 24,
          zIndex: 1400,
          bgcolor: open ? '#003366' : '#fcba19',
          color: open ? '#fff' : '#000',
          fontWeight: 'bold',
          borderRadius: '12px',
          '&:hover': {
            bgcolor: open ? '#002244' : '#e6a817'
          },
          textTransform: 'none',
          boxShadow: 3,
          '@media (max-width: 600px)': {
            bottom: 70
          }
        }}
        onClick={handleToggle}
      >
        {open ? (
          <>
            {' '}
            <span
              style={{ display: 'flex', alignItems: 'center', marginRight: 4 }}
            >
              <CloseIcon style={{ minWidth: 22, minHeight: 22 }} />
            </span>
            Close Assistant
          </>
        ) : (
          <>
            <span
              style={{ display: 'flex', alignItems: 'center', marginRight: 8 }}
            >
              <ChatIcon style={{ minWidth: 22, minHeight: 22 }} />
            </span>
            LCFS Assistant
          </>
        )}
      </Fab>
    </>
  )
}

export default ChatWidget
