import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { ROUTES } from '@/routes/routes'
import withRole from '@/utils/withRole'
import { useTranslation } from 'react-i18next'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import { List, ListItemButton } from '@mui/material'
import { roles } from '@/constants/roles'

const AdminLinksCard = () => {
  const { t } = useTranslation(['dashboard'])
  const getLinkDataTest = (route) => {
    const sanitizedRoute = route?.replace(/^\//, '').replace(/\//g, '-') || ''
    return `admin-link-${sanitizedRoute || 'root'}`
  }
  const adminLinks = useMemo(
    () => [
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
    ],
    [t]
  )
  const navigate = useNavigate()

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

const AllowedRoles = [roles.administrator, roles.government]
const IDIRAdminLinksWithRole = withRole(AdminLinksCard, AllowedRoles)

export default IDIRAdminLinksWithRole
