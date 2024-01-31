import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'

import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import { ROUTES } from '@/constants/routes'
import { List, ListItemButton } from '@mui/material'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'

export const IDIRRightColWIdget = () => {
  const adminLinks = useMemo(() => [
    {
      title: 'Manage government users',
      route: ROUTES.ADMIN_USERS
    },
    {
      title: 'Add/edit fuel suppliers',
      route: ROUTES.ORGANIZATIONS
    },
    {
      title: 'User activity',
      route: ROUTES.ADMIN_USERACTIVITY
    }
  ])
  const navigate = useNavigate()

  return (
    <BCWidgetCard
      component="div"
      style={{ width: '40vh'}}
      color="nav"
      icon="admin"
      title="Administration"
      avatar={<AdminPanelSettingsIcon fontSize="large" color="inherit" />}
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
