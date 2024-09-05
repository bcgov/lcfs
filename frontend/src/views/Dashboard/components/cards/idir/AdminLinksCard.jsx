import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { ROUTES } from '@/constants/routes'
import withRole from '@/utils/withRole'
import { useTranslation } from 'react-i18next'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import { List, ListItemButton } from '@mui/material'
import { roles } from '@/constants/roles'

const AdminLinksCard = () => {
  const { t } = useTranslation(['dashboard'])
  const adminLinks = useMemo(
    () => [
      {
        title: t('dashboard:adminLinks.mngGovUsrsLabel'),
        route: ROUTES.ADMIN_USERS
      },
      {
        title: t('dashboard:adminLinks.addEditOrgsLabel'),
        route: ROUTES.ORGANIZATIONS
      },
      {
        title: t('dashboard:adminLinks.usrActivity'),
        route: ROUTES.ADMIN_USERACTIVITY
      }
    ],
    [t]
  )
  const navigate = useNavigate()

  return (
    <BCWidgetCard
      component="div"
      disableHover={true}
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
