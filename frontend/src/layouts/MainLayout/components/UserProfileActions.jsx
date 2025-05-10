import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
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
import { Notifications, Logout as LogoutIcon } from '@mui/icons-material'
import { NavLink, useLocation } from 'react-router-dom'
import { ROUTES, buildPath } from '@/routes/routes'

export const UserProfileActions = () => {
  const { t } = useTranslation()
  const auth = useAuth()
  const { data: currentUserData } = useCurrentUser()
  const location = useLocation()

  // TODO:
  // Automatically refetch every 1 minute (60000ms) for real-time updates.
  // Alternatively, for better efficiency and scalability, consider implementing
  // server-side push mechanisms (e.g., WebSockets, Server-Sent Events) to notify
  // the client of updates as they occur, reducing unnecessary polling.
  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    refetch
  } = useNotificationsCount({
    refetchInterval: 60000 // Automatically refetch every 1 minute (60000ms)
  })
  const notificationsCount = notificationsData?.count || 0

  // Call refetch whenever the route changes
  useEffect(() => {
    refetch()
  }, [location, refetch])

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

  if (auth.isLoading) {
    return <CircularProgress size={24} sx={{ color: '#fff', mx: 2 }} />
  }

  // Use auth.user.profile for display name if available, fallback to currentUserData
  const displayName =
    auth.user?.profile?.name ||
    (currentUserData?.firstName && currentUserData?.lastName
      ? `${currentUserData.firstName} ${currentUserData.lastName}`
      : 'User')

  // Determine if user specific link should be shown
  const showUserLink =
    auth.user?.profile &&
    currentUserData?.organization?.organizationId &&
    currentUserData?.userProfileId
  const userProfilePath = showUserLink
    ? buildPath(
        currentUserData?.isGovernmentUser
          ? ROUTES.ADMIN.USERS.VIEW
          : ROUTES.ORGANIZATION.VIEW_USER,
        {
          orgID: currentUserData?.organization?.organizationId,
          userID: currentUserData?.userProfileId
        }
      )
    : '#' // Fallback path if needed, or hide link

  return (
    auth.isAuthenticated && (
      <BCBox
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mr={3}
      >
        {showUserLink && (
          <>
            <BCTypography
              component={NavLink}
              to={userProfilePath}
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
              {displayName}
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
          {notificationsLoading ? (
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
          onClick={() => auth.signoutRedirect()}
          color="light"
          size="small"
          variant="outlined"
          data-test="logout-button"
          startIcon={<LogoutIcon sx={{ width: '18px', height: '18px' }} />}
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
