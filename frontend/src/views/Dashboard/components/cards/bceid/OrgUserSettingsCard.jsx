import React from 'react'
import { List, ListItemButton, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import withRole from '@/utils/withRole'
import { nonGovRoles } from '@/constants/roles'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ROUTES } from '@/constants/routes'

const linkStyle = {
  textDecoration: 'underline',
  color: 'link.main',
  '&:hover': { color: 'info.main' }
}

const UserSettingsLink = ({ onClick, children }) => (
  <ListItemButton onClick={onClick}>
    <Typography variant="subtitle2" sx={linkStyle} component="p">
      {children}
    </Typography>
  </ListItemButton>
)

const OrgUserSettingsCard = () => {
  const { t } = useTranslation(['dashboard'])
  const { data: currentUser } = useCurrentUser()
  const navigate = useNavigate()

  const { title, firstName, lastName } = currentUser || {}
  const name = [firstName, lastName].filter(Boolean).join(' ')
  const displayName = [name, title].filter(Boolean).join(', ')

  return (
    <BCWidgetCard
      component="div"
      color="nav"
      icon="user"
      title={t('dashboard:orgUserSettings.title')}
      content={
        <Stack spacing={1}>
          <BCTypography
            variant="body2"
            sx={{ fontWeight: 'bold', color: '#003366' }}
          >
            {displayName}
          </BCTypography>

          <List component="nav" sx={{ maxWidth: '100%', mt: 1 }}>
            <UserSettingsLink onClick={() => navigate(ROUTES.NOTIFICATIONS)}>
              {t('dashboard:orgUserSettings.notifications')}
            </UserSettingsLink>

            <UserSettingsLink
              onClick={() => navigate(ROUTES.NOTIFICATIONS_SETTINGS)}
            >
              {t('dashboard:orgUserSettings.configureNotifications')}
            </UserSettingsLink>

            {/* TODO: Update the link to the help page */}
            <UserSettingsLink onClick={() => navigate()}>
              {t('dashboard:orgUserSettings.help')}
              <FontAwesomeIcon
                icon={faArrowUpRightFromSquare}
                style={{ color: '#547D59', marginLeft: 6 }}
              />
            </UserSettingsLink>
          </List>
        </Stack>
      }
    />
  )
}

export default withRole(OrgUserSettingsCard, nonGovRoles)
