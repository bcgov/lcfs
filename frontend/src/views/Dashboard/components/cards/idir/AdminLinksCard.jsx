import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { ROUTES } from '@/routes/routes'
import withRole from '@/utils/withRole'
import { useTranslation } from 'react-i18next'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import { List, ListItemButton } from '@mui/material'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const AdminLinksCard = () => {
  const { t } = useTranslation(['dashboard'])
  const { hasRoles } = useCurrentUser()
  const isAdmin = hasRoles(roles.administrator)
  const isSystemAdmin = hasRoles(roles.system_admin)

  const getLinkDataTest = (route) => {
    const sanitizedRoute = route?.replace(/^\//, '').replace(/\//g, '-') || ''
    return `admin-link-${sanitizedRoute || 'root'}`
  }

  const adminLinks = useMemo(() => {
    const links = []
    if (isAdmin) {
      links.push(
        {
          title: t('dashboard:adminLinks.mngGovUsrsLabel'),
          route: ROUTES.ADMIN.USERS.LIST
        },
        {
          title: t('dashboard:adminLinks.addEditOrgsLabel'),
          route: ROUTES.ORGANIZATIONS.LIST
        },
        {
          title: t('dashboard:adminLinks.usrActivity'),
          route: ROUTES.ADMIN.USER_ACTIVITY
        }
      )
    }
    // Logon screen background is a System Admin-only responsibility.
    if (isSystemAdmin) {
      links.push({
        title: t('dashboard:adminLinks.loginScreenBackground'),
        route: ROUTES.ADMIN.LOGIN_SCREEN_BACKGROUND
      })
    }
    return links
  }, [isAdmin, isSystemAdmin, t])

  const navigate = useNavigate()

  if (adminLinks.length === 0) {
    return null
  }

  return (
    <BCWidgetCard
      component="div"
      data-test="dashboard-admin-links-card"
      color="nav"
      icon="admin"
      title={t('dashboard:adminLinks.administration')}
      content={
        <List component="div" sx={{ maxWidth: '100%' }}>
          {adminLinks.map((link, index) => (
            <ListItemButton
              component="a"
              key={index}
              alignItems="flex-start"
              onClick={() => navigate(link.route)}
              data-test={getLinkDataTest(link.route)}
            >
              <BCTypography
                variant="subtitle2"
                component="p"
                color="link"
                sx={{
                  textDecoration: 'underline',
                  '&:hover': { color: 'info.main' }
                }}
              >
                {link.title}
              </BCTypography>
            </ListItemButton>
          ))}
        </List>
      }
    />
  )
}

const AllowedRoles = [roles.administrator, roles.government, roles.system_admin]
const IDIRAdminLinksWithRole = withRole(AdminLinksCard, AllowedRoles)

export default IDIRAdminLinksWithRole
