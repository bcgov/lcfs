import BCNavbar from '@/components/BCNavbar'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { HeaderComponent } from './HeaderComponent'
import { Logout } from './Logout'
import { useMediaQuery, useTheme } from '@mui/material'

export const Navbar = () => {
  const { t } = useTranslation()
  const { data: currentUser, hasRoles } = useCurrentUser()
  const theme = useTheme()
  const isMobileView = useMediaQuery(theme.breakpoints.down('xl'))

  // Nav Links
  const navMenuItems = useMemo(() => {
    const isAdmin = hasRoles(roles.administrator)
    const idirRoutes = [
      { name: t('Dashboard'), route: ROUTES.DASHBOARD },
      { name: t('Organizations'), route: ROUTES.ORGANIZATIONS },
      { name: t('Transactions'), route: ROUTES.TRANSACTIONS },
      { name: t('ComplianceReporting'), route: ROUTES.REPORTS },
      {
        name: t('FuelCodes'),
        route: ROUTES.FUELCODES
      },
      { name: t('Administration'), route: ROUTES.ADMIN, hide: !isAdmin }
    ]
    const bceidRoutes = [
      { name: t('Dashboard'), route: ROUTES.DASHBOARD },
      { name: t('Transactions'), route: ROUTES.TRANSACTIONS },
      { name: t('ComplianceReporting'), route: ROUTES.REPORTS },
      { name: t('Organization'), route: ROUTES.ORGANIZATION }
    ]
    const mobileRoutes = [{ name: t('logout'), route: ROUTES.LOG_OUT }]

    const activeRoutes = currentUser?.isGovernmentUser
      ? idirRoutes
      : bceidRoutes

    if (isMobileView) {
      activeRoutes.push(...mobileRoutes)
    }
    return activeRoutes
  }, [currentUser, t, isMobileView, hasRoles])

  return (
    <BCNavbar
      title={t('title')}
      routes={navMenuItems}
      beta={true}
      data-test="main-layout-navbar"
      headerRightPart={<HeaderComponent key="headerRight" />}
      menuRightPart={<Logout key="menRight" />}
    />
  )
}
