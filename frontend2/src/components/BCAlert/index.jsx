import { useState } from 'react'

// prop-types is a library for typechecking of props
import PropTypes from 'prop-types'

// @mui material components
import Fade from '@mui/material/Fade'
import InfoIcon from '@mui/icons-material/Info'
import ErrorIcon from '@mui/icons-material/Error'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/Close'

// Custom styles for the BCAlert
import BCBox from '@/components/BCBox'
import BCAlertRoot from '@/components/BCAlert/BCAlertRoot'

function BCAlert({ severity, dismissible, children, ...rest }) {
  const [alertStatus, setAlertStatus] = useState('mount')
  const color = severity
  const handleAlertStatus = () => setAlertStatus('fadeOut')

  // The base template for the alert
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

// Setting default values for the props of BCAlert
BCAlert.defaultProps = {
  severity: 'info',
  dismissible: false
}

// Typechecking props of the BCAlert
BCAlert.propTypes = {
  severity: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
  dismissible: PropTypes.bool,
  children: PropTypes.node.isRequired
}

export default BCAlert
