import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
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

const BCAlert = forwardRef(({ severity, dismissible, delay, children, ...rest }, ref) => {
  const [alertStatus, setAlertStatus] = useState('mount')
  const [triggerCount, setTriggerCount] = useState(0)
  const color = severity

  useEffect(() => {
    setAlertStatus('mount')
    const timer = setTimeout(() => {
      setAlertStatus('fadeOut')
    }, delay)
    return () => clearTimeout(timer)
  }, [triggerCount, delay])

  useImperativeHandle(ref, () => ({
    triggerAlert: () => {
      // Increment triggerCount to trigger re-render
      setTriggerCount((prevCount) => prevCount + 1)
    }
  }))

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
})

BCAlert.displayName = 'BCAlert'

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
