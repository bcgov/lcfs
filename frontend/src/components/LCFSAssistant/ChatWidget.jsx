import { useState } from 'react'
import PropTypes from 'prop-types'
import { Fab, Paper, Fade, Box, useMediaQuery } from '@mui/material'
import { Chat as ChatIcon, Close as CloseIcon } from '@mui/icons-material'
import ChatWindow from './ChatWindow'
import { useChatAssistant } from '@/hooks/useChatAssistant'

const ChatWidget = () => {
  const [open, setOpen] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [chatKey, setChatKey] = useState(0) // Key to force remount
  const isMobile = useMediaQuery('(max-width: 650px)')
  const chat = useChatAssistant()

  const handleToggle = () => {
    if (!open) {
      // Reset chat when opening - increment key to force remount
      chat.clearMessages()
      setChatKey((prev) => prev + 1)
      setIsMaximized(false)
    }
    setOpen(!open)
  }

  return (
    <>
      {/* Chat Window */}
      <Fade in={open}>
        <Box
          sx={{
            position: 'fixed',
            // When maximized: center the box in viewport
            // When normal: bottom-right corner
            ...(isMaximized && !isMobile
              ? {
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  bottom: 'auto',
                  right: 'auto'
                }
              : {
                  bottom: isMobile ? 0 : 137,
                  right: isMobile ? 0 : 24
                }),
            width: isMobile
              ? '100%'
              : isMaximized
                ? 'min(900px, calc(100vw - 80px))'
                : 430,
            height: isMobile
              ? '100vh'
              : isMaximized
                ? 'min(800px, calc(100vh - 80px))'
                : 'min(700px, calc(100vh - 180px))',
            maxHeight: '100vh',
            maxWidth: '100vw',
            display: open ? 'flex' : 'none',
            zIndex: 1300,
            borderRadius: isMobile ? 0 : '8px',
            transition:
              'width 0.3s ease, height 0.3s ease, transform 0.3s ease, top 0.3s ease, left 0.3s ease, bottom 0.3s ease, right 0.3s ease',
            boxShadow: isMaximized
              ? '0 8px 40px rgba(0, 0, 0, 0.2)'
              : '0 4px 24px rgba(0, 0, 0, 0.15)'
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: isMobile ? 0 : '8px',
              overflow: 'hidden',
              boxShadow: 'none',
              border: isMobile ? 'none' : '1px solid #9ca3af',
              bgcolor: 'background.paper'
            }}
          >
            <ChatWindow
              key={chatKey}
              onClose={handleToggle}
              chat={chat}
              isMaximized={isMaximized}
              onToggleMaximize={() => setIsMaximized(!isMaximized)}
            />
          </Paper>
        </Box>
      </Fade>

      {/* Floating Action Button - hidden on mobile when chat is open */}
      <Fab
        variant="extended"
        aria-label={open ? 'Close LCFS Assistant' : 'Open LCFS Assistant'}
        sx={{
          position: 'fixed',
          bottom: 80,
          right: 24,
          zIndex: 1400,
          bgcolor: open ? '#003366' : '#fcba19',
          color: open ? '#fff' : '#1f2937',
          fontWeight: 500,
          borderRadius: '8px',
          '&:hover': {
            bgcolor: open ? '#002244' : '#e6a817'
          },
          textTransform: 'none',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          display: open && isMaximized ? 'none' : 'flex',
          '@media (max-width: 650px)': {
            display: open ? 'none' : 'flex',
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
