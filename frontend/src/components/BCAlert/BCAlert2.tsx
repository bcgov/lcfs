import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
  type ForwardedRef
} from 'react'
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
import BCAlertRoot, { type AlertSeverity } from '@/components/BCAlert/BCAlertRoot'
import { CircularProgress } from '@mui/material'
import type { BoxProps } from '@mui/material/Box'

type AlertStatus = 'mount' | 'fadeOut' | 'unmount'

export interface BCAlert2Handle {
  triggerAlert: (payload: { severity: AlertSeverity; message: string }) => void
  clearAlert: () => void
}

export interface BCAlert2Props extends Omit<BoxProps, 'color'> {
  dismissible?: boolean
  noFade?: boolean
  delay?: number
}

export const BCAlert2 = forwardRef(
  (
    { dismissible = false, noFade = false, delay = 5000, ...rest }: BCAlert2Props,
    ref: ForwardedRef<BCAlert2Handle>
  ) => {
    const [alertStatus, setAlertStatus] = useState<AlertStatus>('mount')
    const [triggerCount, setTriggerCount] = useState(0)
    const [isOverflowing, setIsOverflowing] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)

    const [message, setMessage] = useState('')
    const [severity, setSeverity] = useState<AlertSeverity | null>(null)

    const textContainerRef = useRef<HTMLDivElement | null>(null)

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
      setIsExpanded((prev) => !prev)
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
      const fadeExemptSeverities: AlertSeverity[] = ['error', 'pending', 'warning']
      if (noFade || (severity && fadeExemptSeverities.includes(severity))) {
        return
      }
      const timer = setTimeout(() => {
        setAlertStatus('fadeOut')
      }, delay)
      return () => clearTimeout(timer)
    }, [delay, noFade, severity, triggerCount])

    useImperativeHandle(
      ref,
      () => ({
        triggerAlert: ({ severity: newSeverity, message: newMessage }) => {
          setSeverity(newSeverity)
          setMessage(newMessage)
          setTriggerCount((prevCount) => prevCount + 1)
        },
        clearAlert: () => {
          setAlertStatus('fadeOut')
        }
      }),
      []
    )

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
              variant={severity === 'pending' ? 'warning' : severity || 'info'}
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
                style={{ rotate: isExpanded ? '180deg' : undefined }}
                onClick={toggleText}
              />
            )}
            {canDismiss && (
              <CloseIcon
                onClick={mount ? handleAlertStatus : undefined}
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
