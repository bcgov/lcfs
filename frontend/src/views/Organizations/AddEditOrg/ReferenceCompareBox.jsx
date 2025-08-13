import { useState } from 'react'
import { Box, IconButton, Tooltip, Fade } from '@mui/material'
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material'
import BCTypography from '@/components/BCTypography'

const ReferenceCompareBox = ({
  title,
  data,
  onDismiss,
  isDismissed = false
}) => {
  const [hoveredItem, setHoveredItem] = useState(null)
  const [copiedItem, setCopiedItem] = useState(null)

  const copyToClipboard = async (text, itemKey) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItem(itemKey)
      setTimeout(() => setCopiedItem(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  if (isDismissed) return null

  return (
    <Fade in={true} timeout={300}>
      <Box
        sx={{
          position: 'relative',
          mb: 2,
          border: '2px solid #fcba19',
          borderRadius: 2,
          bgcolor: '#fffff8ff',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(218, 235, 156, 0.1)',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(218, 235, 156, 0.1)'
          }
        }}
      >
        {/* Content */}
        <Box sx={{ p: 0 }}>
          {data.map((item, index) => (
            <>
              <Box
                key={index}
                onMouseEnter={() => setHoveredItem(index)}
                onMouseLeave={() => setHoveredItem(null)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 0.5,
                  px: 1,
                  mb: index < data.length - 1 ? 1 : 0,
                  borderRadius: 1,
                  transition: 'all 0.2s ease-in-out',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'rgba(133, 127, 46, 0.05)'
                    // transform: 'translateX(2px)'
                  }
                }}
                onClick={() => copyToClipboard(item.value, index)}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {item.label && (
                    <BCTypography
                      variant="caption"
                      component="span"
                      sx={{
                        color: '#666',
                        fontWeight: 500,
                        fontSize: '0.975rem'
                      }}
                    >
                      {item.label}
                      {': '}
                    </BCTypography>
                  )}
                  <BCTypography
                    component="span"
                    variant="body2"
                    sx={{
                      color: '#333',
                      fontWeight: 500,
                      wordBreak: 'break-word',
                      lineHeight: 1.4
                    }}
                  >
                    {item.value}
                  </BCTypography>
                </Box>

                {/* Copy Button */}
                <Fade
                  in={hoveredItem === index || copiedItem === index}
                  timeout={200}
                >
                  <Box sx={{ ml: 1, minWidth: 32 }}>
                    <Tooltip
                      title={
                        copiedItem === index ? 'Copied!' : 'Copy to clipboard'
                      }
                      arrow
                    >
                      <IconButton
                        size="small"
                        sx={{
                          color: copiedItem === index ? '#fcba19' : '#999',
                          bgcolor:
                            copiedItem === index
                              ? 'rgba(46, 133, 64, 0.1)'
                              : 'transparent',
                          '&:hover': {
                            color: '#fcba19',
                            bgcolor: 'rgba(46, 133, 64, 0.1)',
                            transform: 'scale(1.1)'
                          },
                          transition: 'all 0.2s ease-in-out'
                        }}
                      >
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Fade>
                {/* Close Button */}
                {index === 0 && (
                  <Tooltip title="Dismiss reference" arrow>
                    <IconButton
                      size="small"
                      onClick={onDismiss}
                      sx={{
                        color: '#666',
                        '&:hover': {
                          color: '#fcba19',
                          bgcolor: 'rgba(46, 133, 64, 0.1)'
                        }
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </>
          ))}
        </Box>
      </Box>
    </Fade>
  )
}

export default ReferenceCompareBox
