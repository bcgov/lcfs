import { useEffect, useRef } from 'react'
import { logout } from '@/utils/keycloak'
import { useKeycloak } from '@react-keycloak/web'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import DefaultNavbarLink from '@/components/BCNavbar/components/DefaultNavbarLink'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNotificationsCount } from '@/hooks/useNotifications'
import {
  Badge,
  IconButton,
  Divider,
  CircularProgress,
  Tooltip
} from '@mui/material'
import { Notifications, Logout } from '@mui/icons-material'
import { NavLink } from 'react-router-dom'
import { ROUTES, buildPath } from '@/routes/routes'

export const UserProfileActions = () => {
  const { t } = useTranslation()
  const { data: currentUser } = useCurrentUser()
  const { keycloak } = useKeycloak()
  const intervalRef = useRef(null)

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
    cacheTime: 5 * 60 * 1000 // Keep in cache for 5 minutes
  })
  const notificationsCount = notificationsData?.count || 0

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

  const iconBtn = (
    <IconButton
      color="inherit"
      className="small-icon"
      sx={{ mx: 1 }}
      title={t('Notifications')}
      aria-label={t('Notifications')}
    >
      <Badge
        badgeContent={notificationsCount > 0 ? notificationsCount : null}
        color="error"
      >
        <Notifications />
      </Badge>
    </IconButton>
  )

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
                marginRight: '12px',
                maxWidth: '17vw'
              }}
              variant="subtitle1"
              color="light"
            >
              {`${currentUser.firstName} ${currentUser.lastName}`}
            </BCTypography>
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
        <>
          {isLoading ? (
            <CircularProgress size={24} sx={{ color: '#fff', mx: 2 }} />
          ) : (
            <Tooltip title={t('Notifications')}>
              <DefaultNavbarLink
                icon={iconBtn}
                name={''}
                route={ROUTES.NOTIFICATIONS.LIST}
                light={false}
                isMobileView={false}
                sx={{
                  '&': {
                    marginRight: 0,
                    marginLeft: 0,
                    padding: '2px',
                    paddingBottom: '10px'
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.3)'
                  },
                  '&.active': {
                    borderBottom: '3px solid #fcc219',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    paddingBottom: '7px'
                  }
                }}
              />
            </Tooltip>
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
        </>
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
