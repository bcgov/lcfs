import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef
} from 'react'
import PropTypes from 'prop-types'
import Fade from '@mui/material/Fade'
import {
  Info as InfoIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  ExpandMore
} from '@mui/icons-material'
import BCBox from '@/components/BCBox'
import BCAlertRoot from '@/components/BCAlert/BCAlertRoot'
import { CircularProgress } from '@mui/material'

export const BCAlert2 = forwardRef(
  ({ dismissible = false, noFade, delay = 5000, ...rest }, ref) => {
    const [alertStatus, setAlertStatus] = useState('mount')
    const [triggerCount, setTriggerCount] = useState(0)
    const [isOverflowing, setIsOverflowing] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)

    const [message, setMessage] = useState('')
    const [severity, setSeverity] = useState(null)

    const textContainerRef = useRef(null)

    const color = severity
    const canDismiss = noFade || severity === 'error' ? true : dismissible

    const checkOverflow = () => {
      const textContainer = textContainerRef.current
      if (textContainer) {
        setIsOverflowing(
          textContainer.scrollHeight > textContainer.clientHeight ||
            textContainer.scrollWidth > textContainer.clientWidth
        )
      }
    }

    const toggleText = () => {
      setIsExpanded(!isExpanded)
    }

    useEffect(() => {
      checkOverflow()
      window.addEventListener('resize', checkOverflow)
      return () => {
        window.removeEventListener('resize', checkOverflow)
      }
    }, [])

    useEffect(() => {
      setAlertStatus('mount')
      if (noFade || ['error', 'pending', 'warning'].includes(severity)) {
        return
      }
      const timer = setTimeout(() => {
        setAlertStatus('fadeOut')
      }, delay)
      return () => clearTimeout(timer)
    }, [delay, noFade, severity, triggerCount])

    useImperativeHandle(ref, () => ({
      triggerAlert: ({ severity, message }) => {
        setSeverity(severity)
        setMessage(message)
        setTriggerCount((prevCount) => prevCount + 1)
      },
      clearAlert: () => {
        setAlertStatus('fadeOut')
      }
    }))

    const handleAlertStatus = () => setAlertStatus('fadeOut')

    const alertTemplate = (mount = true) => (
      <Fade in={mount} timeout={300}>
        <BCAlertRoot ownerState={{ color }} {...rest}>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            {severity === 'info' && <InfoIcon style={{ margin: '5px' }} />}
            {severity === 'warning' && (
              <WarningIcon style={{ margin: '5px' }} />
            )}
            {severity === 'error' && <ErrorIcon style={{ margin: '5px' }} />}
            {severity === 'success' && (
              <CheckCircleIcon style={{ margin: '5px' }} />
            )}
            {severity === 'pending' && (
              <CircularProgress size={16} style={{ margin: 5 }} />
            )}
            <BCBox
              variant={severity === 'pending' ? 'warning' : severity}
              ref={textContainerRef}
              className={isExpanded ? 'expanded' : ''}
              style={{
                width: '100%',
                overflow: 'hidden',
                whiteSpace: isExpanded ? 'normal' : 'nowrap',
                textOverflow: 'ellipsis',
                WebkitLineClamp: isExpanded ? 'unset' : 1,
                WebkitBoxOrient: 'vertical',
                transition: 'max-height 0.3s ease'
              }}
            >
              {message}
            </BCBox>{' '}
            {isOverflowing && (
              <ExpandMore
                fontSize="medium"
                style={{ rotate: isExpanded && '180deg' }}
                onClick={toggleText}
              />
            )}
            {canDismiss && (
              <CloseIcon
                onClick={mount ? handleAlertStatus : null}
                sx={{ cursor: 'pointer' }}
              />
            )}
          </div>
        </BCAlertRoot>
      </Fade>
    )

    if (!severity) return null

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
)

BCAlert2.displayName = 'BCAlert2'

BCAlert2.propTypes = {
  dismissible: PropTypes.bool,
  delay: PropTypes.number,
  noFade: PropTypes.bool
}
