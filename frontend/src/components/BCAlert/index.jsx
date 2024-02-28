import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import Fade from '@mui/material/Fade'
import {
  Info as InfoIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon
} from '@mui/icons-material'
import BCBox from '@/components/BCBox'
import BCAlertRoot from '@/components/BCAlert/BCAlertRoot'

function BCAlert({ severity, dismissible, delay, children, ...rest }) {
  const [alertStatus, setAlertStatus] = useState('mount')
  const color = severity

  useEffect(() => {
    const timer = setTimeout(() => {
      setAlertStatus('fadeOut')
    }, delay)
    return () => clearTimeout(timer)
  }, [])

  const handleAlertStatus = () => setAlertStatus('fadeOut')

  const alertTemplate = (mount = true) => (
    <Fade in={mount} timeout={300}>
      <BCAlertRoot ownerState={{ color }} {...rest}>
        <BCBox display="flex" alignItems="center" variant={severity}>
          {severity === 'info' && <InfoIcon style={{ margin: '5px' }} />}
          {severity === 'warning' && <WarningIcon style={{ margin: '5px' }} />}
          {severity === 'error' && <ErrorIcon style={{ margin: '5px' }} />}
          {severity === 'success' && (
            <CheckCircleIcon style={{ margin: '5px' }} />
          )}
          {children}
        </BCBox>
        {dismissible ? (
          <CloseIcon
            onClick={mount ? handleAlertStatus : null}
            sx={{ cursor: 'pointer' }}
          />
        ) : null}
      </BCAlertRoot>
    </Fade>
  )

  switch (true) {
    case alertStatus === 'mount':
      return alertTemplate()
    case alertStatus === 'fadeOut':
      setTimeout(() => setAlertStatus('unmount'), 400)
      return alertTemplate(false)
    default:
      alertTemplate()
      break
  }

  return null
}

BCAlert.defaultProps = {
  severity: 'info',
  dismissible: false,
  delay: 5000 // default fade out in 5s
}

BCAlert.propTypes = {
  severity: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
  dismissible: PropTypes.bool,
  delay: PropTypes.number,
  children: PropTypes.node.isRequired
}

export default BCAlert
