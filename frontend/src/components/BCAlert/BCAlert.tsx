import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
  type ReactNode,
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

export interface BCAlertHandle {
  triggerAlert: () => void
}

export interface BCAlertProps extends Omit<BoxProps, 'color'> {
  severity?: AlertSeverity
  dismissible?: boolean
  noFade?: boolean
  delay?: number
  children: ReactNode
}

export const BCAlert = forwardRef(
  (
    {
      severity = 'info',
      dismissible = false,
      noFade = false,
      delay = 5000,
      children,
      ...rest
    }: BCAlertProps,
    ref: ForwardedRef<BCAlertHandle>
  ) => {
    const [alertStatus, setAlertStatus] = useState<AlertStatus>('mount')
    const [triggerCount, setTriggerCount] = useState(0)
    const [isOverflowing, setIsOverflowing] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const textContainerRef = useRef<HTMLDivElement | null>(null)

    const color = severity

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
      if (noFade || severity === 'error' || severity === 'pending') return
      const timer = setTimeout(() => {
        setAlertStatus('fadeOut')
      }, delay)
      return () => clearTimeout(timer)
    }, [triggerCount, delay, severity, noFade])

    useImperativeHandle(
      ref,
      () => ({
        triggerAlert: () => {
          setTriggerCount((prevCount) => prevCount + 1)
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
              variant={severity}
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
              {children}
            </BCBox>{' '}
            {isOverflowing && (
              <ExpandMore
                fontSize="medium"
                style={{ rotate: isExpanded ? '180deg' : undefined }}
                onClick={toggleText}
              />
            )}
            {dismissible && (
              <CloseIcon
                onClick={mount ? handleAlertStatus : undefined}
                sx={{ cursor: 'pointer' }}
              />
            )}
          </div>
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
)

BCAlert.displayName = 'BCAlert'
