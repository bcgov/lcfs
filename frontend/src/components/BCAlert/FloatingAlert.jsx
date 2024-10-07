// @mui material components
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import { forwardRef, useState, useEffect, useImperativeHandle } from 'react'
import PropTypes from 'prop-types'
import Fade from '@mui/material/Fade'
import { Info as InfoIcon, Error as ErrorIcon, Warning as WarningIcon, CheckCircle as CheckCircleIcon, Close as CloseIcon } from '@mui/icons-material'

// Styled component for the floating alert at the top of the screen
const FloatingAlertRoot = styled(Box)(({ theme, ownerState }) => {
  const { palette, typography, borders, functions } = theme
  const { color } = ownerState

  const { gradients, alerts } = palette
  const { fontSizeMD, fontWeightMedium } = typography
  const { borderRadius } = borders
  const { pxToRem, linearGradient } = functions

  const backgroundImageValue = alerts[color]?.background
    ? linearGradient(alerts[color].background, alerts[color].background)
    : linearGradient(gradients.info.main, gradients.info.state)

  return {
    position: 'fixed',
    top: pxToRem(240),
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1400, // Ensures it's on top of other elements
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: pxToRem(40),
    backgroundImage: backgroundImageValue,
    color: alerts[color]?.color,
    padding: pxToRem(8),
    marginBottom: pxToRem(8),
    borderRadius: borderRadius.md,
    fontSize: fontSizeMD,
    fontWeight: fontWeightMedium,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
  }
})

// Floating Alert Component
export const FloatingAlert = forwardRef(({ dismissible = true, delay = 5000, ...rest }, ref) => {
  const [alertStatus, setAlertStatus] = useState('mount')
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState(null)
  
  const color = severity

  useImperativeHandle(ref, () => ({
    triggerAlert: ({ severity, message }) => {
      setSeverity(severity)
      setMessage(message)
      setAlertStatus('mount')
    }
  }))

  useEffect(() => {
    if (alertStatus === 'mount') {
      const timer = setTimeout(() => setAlertStatus('fadeOut'), delay)
      return () => clearTimeout(timer)
    }
  }, [alertStatus, delay])

  const handleAlertStatus = () => setAlertStatus('fadeOut')

  if (!severity) return null

  return (
    <Fade in={alertStatus === 'mount'} timeout={300}>
      <FloatingAlertRoot ownerState={{ color }} {...rest}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          {severity === 'info' && <InfoIcon style={{ margin: '5px' }} />}
          {severity === 'warning' && <WarningIcon style={{ margin: '5px' }} />}
          {severity === 'error' && <ErrorIcon style={{ margin: '5px' }} />}
          {severity === 'success' && <CheckCircleIcon style={{ margin: '5px' }} />}
          <Box style={{ flexGrow: 1, paddingLeft: 8 }}>{message}</Box>
          {dismissible && (
            <CloseIcon
              onClick={handleAlertStatus}
              sx={{ cursor: 'pointer', marginLeft: '10px' }}
            />
          )}
        </div>
      </FloatingAlertRoot>
    </Fade>
  )
})

FloatingAlert.displayName = 'FloatingAlert'

FloatingAlert.propTypes = {
  dismissible: PropTypes.bool,
  delay: PropTypes.number
}
