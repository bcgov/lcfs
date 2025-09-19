import React from 'react'
import { Typography, Box } from '@mui/material'
import { keyframes } from '@mui/system'
import BCTypography from '@/components/BCTypography'

const blink = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0; }
  100% { opacity: 1; }
`

export const StreamingMessage = ({ content, isStreaming }) => {
  return (
    <Box>
      <BCTypography variant="body1" component="div">
        {content}
        {isStreaming && (
          <span style={{
            animation: `${blink} 1s infinite`,
            marginLeft: '2px',
            fontWeight: 'bold'
          }}>
            ▊
          </span>
        )}
      </BCTypography>
    </Box>
  )
}