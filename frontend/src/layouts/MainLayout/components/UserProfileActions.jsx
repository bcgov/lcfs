import { useEffect } from 'react'
import { logout } from '@/utils/keycloak'
import { useKeycloak } from '@react-keycloak/web'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useNotificationsCount } from '@/hooks/useNotifications'
import {
  Badge,
  IconButton,
  Divider,
  CircularProgress,
  Tooltip
} from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'

export const UserProfileActions = () => {
  const { t } = useTranslation()
  const { data: currentUser } = useCurrentUser()
  const { keycloak } = useKeycloak()
  const navigate = useNavigate()
  const location = useLocation()

  // TODO:
  // Automatically refetch every 1 minute (60000ms) for real-time updates.
  // Alternatively, for better efficiency and scalability, consider implementing
  // server-side push mechanisms (e.g., WebSockets, Server-Sent Events) to notify
  // the client of updates as they occur, reducing unnecessary polling.
  const {
    data: notificationsData,
    isLoading,
    refetch
  } = useNotificationsCount({
    refetchInterval: 60000 // Automatically refetch every 1 minute (60000ms)
  })
  const notificationsCount = notificationsData?.count || 0
  console.log(notificationsData)

  // Call refetch whenever the route changes
  useEffect(() => {
    refetch()
  }, [location, refetch])

  return (
    keycloak.authenticated && (
      <BCBox
        display="flex"
        alignItems="center"
        justifyContent="space-around"
        mr={3}
      >
        {currentUser?.firstName && (
          <>
            <BCTypography variant="subtitle1" color="light" mx={3}>
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
                marginRight: 1
              })}
            />
          </>
        )}
        <>
          {isLoading ? (
            <CircularProgress size={24} sx={{ color: '#fff', mx: 2 }} />
          ) : (
            <Tooltip title={t('Notifications')}>
              <IconButton
                color="inherit"
                sx={{ mx: 1 }}
                onClick={() => navigate(ROUTES.NOTIFICATIONS)}
                aria-label={t('Notifications')}
              >
                <Badge
                  badgeContent={
                    notificationsCount > 0 ? notificationsCount : null
                  }
                  color="error"
                >
                  <NotificationsIcon />
                </Badge>
              </IconButton>
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
              marginLeft: 1,
              marginRight: 3
            })}
          />
        </>
        <BCButton
          onClick={logout}
          color="light"
          size="small"
          variant="outlined"
          data-test="logout-button"
        >
          {t('logout')}
        </BCButton>
      </BCBox>
    )
  )
}
