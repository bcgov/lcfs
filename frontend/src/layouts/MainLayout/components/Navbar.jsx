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
  const { data: currentUser } = useCurrentUser()
  const theme = useTheme()
  const isMobileView = useMediaQuery(theme.breakpoints.down('xl'))

  // Nav Links
  const navMenuItems = useMemo(() => {
    const isAnalyst = currentUser && currentUser.roles.find(
      (role) => role.name === roles.analyst
    )
    const idirRoutes = [
      { name: t('Dashboard'), route: ROUTES.DASHBOARD },
      { name: t('Organizations'), route: ROUTES.ORGANIZATIONS },
      { name: t('Transactions'), route: ROUTES.TRANSACTIONS },
      { name: t('ComplianceReporting'), route: ROUTES.REPORTS },
      {
        name: t('FuelCodes'),
        route: ROUTES.FUELCODES,
        hide: !isAnalyst
      },
      { name: t('Administration'), route: ROUTES.ADMIN }
    ]
    const bceidRoutes = [
      { name: t('Dashboard'), route: ROUTES.DASHBOARD },
      { name: t('Transactions'), route: ROUTES.TRANSACTIONS },
      { name: t('ComplianceReporting'), route: ROUTES.REPORTS },
      { name: t('Organization'), route: ROUTES.ORGANIZATION }
    ]
    const mobileRoutes = [{ name: t('logout'), route: ROUTES.LOG_OUT }]

    const activeRoutes = currentUser?.isGovernmentUser ? idirRoutes : bceidRoutes

    if (isMobileView) {
      activeRoutes.push(...mobileRoutes)
    }
    return activeRoutes
  }, [currentUser, t, isMobileView])

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
