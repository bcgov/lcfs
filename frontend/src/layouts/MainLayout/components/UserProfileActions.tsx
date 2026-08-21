import {
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from 'react'
import { logout } from '@/utils/keycloak'
import { useKeycloak } from '@react-keycloak/web'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useGetNotificationMessages,
  useMarkNotificationAsRead,
  useNotificationsCount
} from '@/hooks/useNotifications'
import { roles } from '@/constants/roles'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import {
  Badge,
  IconButton,
  Divider,
  CircularProgress,
  Tooltip,
  Popper,
  Paper,
  Stack,
  Button,
  Box
} from '@mui/material'
import {
  Close,
  Logout,
  Notifications as NotificationsIcon
} from '@mui/icons-material'
import { NavLink, useNavigate } from 'react-router-dom'
import { ROUTES, buildPath } from '@/routes/routes'
import { RoleSwitcher } from './RoleSwitcher'
import { routesMapping } from '@/views/Notifications/NotificationMenu/components/_schema'

type NotificationMessage = {
  notificationMessageId: number
  type: string
  message: string
  createDate?: string
  isRead?: boolean
  relatedOrganization?: {
    name?: string
  }
}

const latestNotificationOptions = {
  page: 1,
  size: 3,
  sortOrders: [{ field: 'date', direction: 'desc' }],
  filters: []
}

const getNotificationRoute = (
  notification: NotificationMessage,
  currentUser?: Record<string, any>
) => {
  try {
    const parsed = JSON.parse(notification.message)
    const { id, service, compliancePeriod } = parsed
    const serviceKey = service || notification.type
    const routeTemplate = routesMapping(currentUser || {})[serviceKey]

    if (!routeTemplate) {
      return null
    }

    return routeTemplate
      .replace(':transactionId', id)
      .replace(':transferId', id)
      .replace(':compliancePeriod', compliancePeriod)
      .replace(':complianceReportId', id)
      .replace(':ciApplicationId', id)
      .replace(':fuelCodeID', id)
  } catch {
    return null
  }
}

const getNotificationSummary = (notification: NotificationMessage) => {
  try {
    const parsed = JSON.parse(notification.message)
    return parsed.type || notification.type
  } catch {
    return notification.type
  }
}

const getNotificationOrganization = (
  notification: NotificationMessage,
  currentUser?: Record<string, any>
) => {
  try {
    const parsed = JSON.parse(notification.message)
    const { service, toOrganizationId, fromOrganization } = parsed
    if (
      service === 'Transfer' &&
      toOrganizationId === currentUser?.organization?.organizationId
    ) {
      return fromOrganization || ''
    }
  } catch {
    return notification.relatedOrganization?.name || ''
  }

  return notification.relatedOrganization?.name || ''
}

const formatNotificationDate = (date?: string) => {
  if (!date) {
    return ''
  }

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(date))
}

const getNotificationMeta = (
  notification: NotificationMessage,
  currentUser?: Record<string, any>
) => {
  return [
    getNotificationOrganization(notification, currentUser),
    formatNotificationDate(notification.createDate)
  ]
    .filter(Boolean)
    .join(' | ')
}

export const UserProfileActions = () => {
  const { t } = useTranslation()
  const { data: currentUser, hasRoles } = useCurrentUser()
  const { keycloak } = useKeycloak()
  const navigate = useNavigate()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const roleSwitcherAnchorRef = useRef<HTMLDivElement | null>(null)
  const notificationCloseTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false)
  const [notificationAnchorEl, setNotificationAnchorEl] =
    useState<HTMLElement | null>(null)
  const isGovernmentAdmin =
    currentUser?.isGovernmentUser && hasRoles?.(roles.administrator)
  const isRoleSwitcherEnabled = isFeatureEnabled(FEATURE_FLAGS.ROLE_SWITCHER)
  const canUseRoleSwitcher = isGovernmentAdmin && isRoleSwitcherEnabled
  const isNotificationMenuOpen = Boolean(notificationAnchorEl)

  // TODO:
  // Alternatively, for better efficiency and scalability, consider implementing
  // server-side push mechanisms (e.g., WebSockets, Server-Sent Events) to notify
  // the client of updates as they occur, reducing unnecessary polling.
  const {
    data: notificationsData,
    isLoading,
    refetch
  } = useNotificationsCount({
    refetchInterval: false, // Disable automatic refetching by React Query
    staleTime: 0, // Consider data stale immediately so manual refetch works
    gcTime: 5 * 60 * 1000 // Keep in cache for 5 minutes
  })

  const notificationsCount = (notificationsData as any)?.count || 0
  const latestNotifications = useGetNotificationMessages(
    latestNotificationOptions,
    {
      enabled: keycloak.authenticated && isNotificationMenuOpen,
      staleTime: 0,
      gcTime: 5 * 60 * 1000
    }
  )
  const markAsReadMutation = useMarkNotificationAsRead({})
  const notificationMessages =
    (latestNotifications?.data as any)?.notifications || []

  useEffect(() => {
    if (!isRoleSwitcherEnabled) {
      setIsRoleSwitcherOpen(false)
    }
  }, [isRoleSwitcherEnabled])

  useEffect(() => {
    if (!isGovernmentAdmin) {
      setIsRoleSwitcherOpen(false)
    }
  }, [isGovernmentAdmin])

  // Set up manual interval for refetching
  useEffect(() => {
    // Initial fetch when component mounts (if needed)
    if (!notificationsData) {
      refetch()
    }

    // Set up interval to refetch every minute
    intervalRef.current = setInterval(() => {
      refetch()
    }, 60000) // 60000ms = 1 minute

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refetch, notificationsData])

  // Optional: Refetch when user becomes active after being away
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // User returned to the tab, refetch notifications
        refetch()
      }
    }

    const handleFocus = () => {
      // User focused on the window, refetch notifications
      refetch()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [refetch])

  useEffect(() => {
    return () => {
      if (notificationCloseTimerRef.current) {
        clearTimeout(notificationCloseTimerRef.current)
      }
    }
  }, [])

  const cancelNotificationClose = () => {
    if (notificationCloseTimerRef.current) {
      clearTimeout(notificationCloseTimerRef.current)
      notificationCloseTimerRef.current = null
    }
  }

  const openNotificationMenu = (event: ReactMouseEvent<HTMLElement>) => {
    cancelNotificationClose()
    setNotificationAnchorEl(event.currentTarget)
  }

  const openNotificationMenuFromFocus = (event: ReactFocusEvent<HTMLElement>) => {
    cancelNotificationClose()
    setNotificationAnchorEl(event.currentTarget)
  }

  const closeNotificationMenu = () => {
    notificationCloseTimerRef.current = setTimeout(() => {
      setNotificationAnchorEl(null)
    }, 150)
  }

  const closeNotificationMenuWhenFocusLeaves = (
    event: ReactFocusEvent<HTMLElement>
  ) => {
    const nextFocusedElement = event.relatedTarget as Node | null
    if (event.currentTarget.contains(nextFocusedElement)) {
      return
    }
    closeNotificationMenu()
  }

  const handleMarkNotificationRead = (
    event: ReactMouseEvent<HTMLElement>,
    notificationId: number
  ) => {
    event.preventDefault()
    event.stopPropagation()
    markAsReadMutation.mutate({
      notification_ids: [notificationId]
    })
  }

  const handleMarkAllRead = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault()
    markAsReadMutation.mutate({ applyToAll: true })
  }

  const handleNotificationClick = (notification: NotificationMessage) => {
    const route = getNotificationRoute(notification, currentUser)

    markAsReadMutation.mutate({
      notification_ids: [notification.notificationMessageId]
    })

    if (route) {
      setNotificationAnchorEl(null)
      navigate(route)
    }
  }

  const handleNotificationKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
    notification: NotificationMessage
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleNotificationClick(notification)
    }
  }

  const handleNotificationPreviewKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>
  ) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setNotificationAnchorEl(null)
    }
  }

  const iconBtn = (
    <IconButton
      component={NavLink as any}
      to={ROUTES.NOTIFICATIONS.LIST}
      color="inherit"
      className="small-icon"
      sx={{ mx: 1 }}
      aria-label={t('Notifications')}
      aria-haspopup="dialog"
      aria-expanded={isNotificationMenuOpen}
      onFocus={openNotificationMenuFromFocus}
    >
      <Badge
        badgeContent={notificationsCount > 0 ? notificationsCount : null}
        color="error"
      >
        <NotificationsIcon />
      </Badge>
    </IconButton>
  )

  const handleRoleSwitcherClose = () => {
    setIsRoleSwitcherOpen(false)
  }

  return (
    keycloak.authenticated && (
      <BCBox
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mr={3}
      >
        {currentUser?.firstName && (
          <>
            <BCBox
              display="flex"
              alignItems="center"
              ref={roleSwitcherAnchorRef}
              sx={{
                maxWidth: '17vw',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              <BCTypography
                component={NavLink}
                to={buildPath(
                  currentUser?.isGovernmentUser
                    ? ROUTES.ADMIN.USERS.VIEW
                    : ROUTES.ORGANIZATION.VIEW_USER,
                  {
                    orgID: currentUser?.organization?.organizationId,
                    userID: currentUser?.userProfileId
                  }
                )}
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flexShrink: 1,
                  marginRight: canUseRoleSwitcher ? '4px' : '12px'
                }}
                variant="subtitle1"
                color="light"
              >
                {`${currentUser.firstName} ${currentUser.lastName}`}
              </BCTypography>
            </BCBox>
            <Divider
              orientation="vertical"
              variant="middle"
              flexItem
              sx={({ palette: { secondary } }) => ({
                backgroundColor: secondary.main,
                height: '60%',
                alignSelf: 'center',
                marginLeft: 1,
                marginRight: '0.6rem'
              })}
            />
          </>
        )}
        {canUseRoleSwitcher && (
          <RoleSwitcher
            currentUser={currentUser}
            hasRoles={hasRoles}
            open={isRoleSwitcherOpen && canUseRoleSwitcher}
            anchorEl={roleSwitcherAnchorRef.current}
            onClose={handleRoleSwitcherClose}
          />
        )}

        {isLoading ? (
          <CircularProgress size={24} sx={{ color: '#fff', mx: 2 }} />
        ) : (
          <Box
            onMouseEnter={openNotificationMenu}
            onMouseLeave={closeNotificationMenu}
            onBlur={closeNotificationMenuWhenFocusLeaves}
            onKeyDown={handleNotificationPreviewKeyDown}
            sx={{
              marginRight: 0,
              marginLeft: 0,
              padding: '2px',
              paddingBottom: '10px',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.3)'
              }
            }}
          >
            <Tooltip title={t('Notifications')}>{iconBtn}</Tooltip>
            <Popper
              open={isNotificationMenuOpen}
              anchorEl={notificationAnchorEl}
              placement="bottom-end"
              disablePortal
              onMouseEnter={cancelNotificationClose}
              onMouseLeave={closeNotificationMenu}
              sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
            >
              <Paper
                role="dialog"
                aria-label={t('notifications:latestNotifications')}
                onKeyDown={handleNotificationPreviewKeyDown}
                elevation={6}
                sx={{
                  width: 360,
                  mt: 1,
                  borderRadius: 1,
                  overflow: 'hidden'
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ px: 2, py: 1.25, borderBottom: '1px solid #e0e0e0' }}
                >
                  <BCTypography variant="subtitle2" color="text.primary">
                    {t('notifications:latestNotifications')}
                  </BCTypography>
                  <Button
                    size="small"
                    onClick={handleMarkAllRead}
                    disabled={notificationsCount === 0}
                  >
                    <BCTypography variant="body2" color="primary">
                      {'✓ '}{t('notifications:markAllAsRead')}
                    </BCTypography>
                  </Button>
                </Stack>
                <Stack sx={{ maxHeight: 340, overflowY: 'auto' }}>
                  {latestNotifications?.isLoading ? (
                    <Stack alignItems="center" sx={{ py: 3 }}>
                      <CircularProgress size={22} />
                    </Stack>
                  ) : notificationMessages.length === 0 ? (
                    <BCTypography
                      variant="body2"
                      color="text.secondary"
                      sx={{ px: 2, py: 3, textAlign: 'center' }}
                    >
                      {t('notifications:noRecentNotifications')}
                    </BCTypography>
                  ) : (
                    notificationMessages.map(
                      (notification: NotificationMessage) => (
                        <Box
                          key={notification.notificationMessageId}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleNotificationClick(notification)}
                          onKeyDown={(event) =>
                            handleNotificationKeyDown(event, notification)
                          }
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 32px',
                            gap: 1,
                            width: '100%',
                            border: 0,
                            borderBottom: '1px solid #f0f0f0',
                            backgroundColor: notification.isRead
                              ? '#fff'
                              : '#f4f8ff',
                            textAlign: 'left',
                            px: 2,
                            py: 1.25,
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: '#f5f5f5' }
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <BCTypography
                              variant="body2"
                              color="text.primary"
                              sx={{
                                fontWeight: notification.isRead ? 400 : 600
                              }}
                            >
                              {getNotificationSummary(notification)}
                            </BCTypography>
                            <BCTypography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {getNotificationMeta(notification, currentUser)}
                            </BCTypography>
                          </Box>
                          <Tooltip
                            title={t('notifications:markNotificationAsRead')}
                          >
                            <span>
                              <IconButton
                                size="small"
                                aria-label={t(
                                  'notifications:markNotificationAsRead'
                                )}
                                disabled={notification.isRead}
                                onClick={(event) =>
                                  handleMarkNotificationRead(
                                    event,
                                    notification.notificationMessageId
                                  )
                                }
                              >
                                <Close fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      )
                    )
                  )}
                </Stack>
                <NavLink
                  to={ROUTES.NOTIFICATIONS.LIST}
                  onClick={() => setNotificationAnchorEl(null)}
                  style={{
                    display: 'block',
                    padding: '10px 16px',
                    textAlign: 'center',
                    textDecoration: 'none',
                    fontWeight: 600
                  }}
                >
                  <BCTypography variant="body2" color="primary">
                    {t('notifications:viewAllNotifications')}
                  </BCTypography>
                </NavLink>
              </Paper>
            </Popper>
          </Box>
        )}
        <Divider
          orientation="vertical"
          variant="middle"
          flexItem
          sx={({ palette: { secondary } }) => ({
            backgroundColor: secondary.main,
            height: '60%',
            alignSelf: 'center',
            marginLeft: '0.6rem',
            marginRight: 3
          })}
        />
        <BCButton
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={logout}
          color="light"
          size="small"
          variant="outlined"
          data-test="logout-button"
          startIcon={<Logout sx={{ width: '18px', height: '18px' }} />}
          sx={{
            maxHeight: '32px',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              color: 'rgba(0, 0, 0, 0.8)',
              borderColor: 'rgba(0, 0, 0, 0.8)'
            }
          }}
        >
          {t('logout')}
        </BCButton>
      </BCBox>
    )
  )
}
