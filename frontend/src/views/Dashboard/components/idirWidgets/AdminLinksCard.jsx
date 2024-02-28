// hooks
import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { ROUTES } from '@/constants/routes'
import withRole from '@/utils/withRole'
import { useTranslation } from 'react-i18next'
// mui components
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import { List, ListItemButton } from '@mui/material'
import { roles } from '@/constants/roles'

export const AdminLinksCard = () => {
  const { t } = useTranslation(['common', 'admin'])
  const adminLinks = useMemo(
    () => [
      {
        title: t('admin:mngGovUsrsLabel'),
        route: ROUTES.ADMIN_USERS
      },
      {
        title: t('admin:addEditOrgsLabel'),
        route: ROUTES.ORGANIZATIONS
      },
      {
        title: t('admin.usrActivity'),
        route: ROUTES.ADMIN_USERACTIVITY
      }
    ],
    [t]
  )
  const navigate = useNavigate()

  return (
    <BCWidgetCard
      component="div"
      color="nav"
      icon="admin"
      title={t('Administration')}
      content={
        <List component="div" sx={{ maxWidth: '100%' }}>
          {adminLinks.map((link, index) => (
            <ListItemButton
              component="a"
              key={index}
              alignItems="flex-start"
              onClick={() => navigate(link.route)}
            >
              <BCTypography
                variant="subtitle2"
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
