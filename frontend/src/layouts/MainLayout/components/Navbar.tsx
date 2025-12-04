import BCNavbar from '@/components/BCNavbar'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { HeaderComponent } from './HeaderComponent'
import { UserProfileActions } from './UserProfileActions'
import { useMediaQuery, useTheme } from '@mui/material'

type NavItem = {
  name: string
  route: string
  hide?: boolean
}

export const Navbar = () => {
  const { t } = useTranslation()
  const { data: currentUser, hasRoles, hasAnyRole } = useCurrentUser()
  const theme = useTheme()
  const isMobileView = useMediaQuery(theme.breakpoints.down('xl'))

  // Nav Links
  const navMenuItems = useMemo<NavItem[]>(() => {
    const isAdmin = hasRoles(roles.administrator)
    const canSeeComplianceReports = hasAnyRole(
      roles.government,
      roles.signing_authority,
      roles.compliance_reporting
    )
    const idirRoutes: NavItem[] = [
      { name: t('Dashboard'), route: ROUTES.DASHBOARD },
      { name: t('Organizations'), route: ROUTES.ORGANIZATIONS.LIST },
      { name: t('Transactions'), route: ROUTES.TRANSACTIONS.LIST },
      { name: t('ComplianceReporting'), route: ROUTES.REPORTS.LIST },
      {
        name: t('FuelCodes'),
        route: ROUTES.FUEL_CODES.LIST
      },
      { name: t('Administration'), route: ROUTES.ADMIN.MAIN, hide: !isAdmin }
    ]
    const bceidRoutes = [
      { name: t('Dashboard'), route: ROUTES.DASHBOARD },
      { name: t('Transactions'), route: ROUTES.TRANSACTIONS.LIST },
      {
        name: t('ComplianceReporting'),
        route: ROUTES.REPORTS.LIST,
        hide: !canSeeComplianceReports
      },
      { name: t('Organization'), route: ROUTES.ORGANIZATION.ORG }
    ]
    const mobileRoutes = [
      { name: t('Notifications'), route: ROUTES.NOTIFICATIONS.LIST },
      { name: t('logout'), route: ROUTES.AUTH.LOG_OUT }
    ]

    const activeRoutes = currentUser?.isGovernmentUser
      ? idirRoutes
      : bceidRoutes

    if (isMobileView) {
      activeRoutes.push(...mobileRoutes)
    }
    return activeRoutes
  }, [currentUser, t, isMobileView, hasRoles, hasAnyRole])

  return (
    <BCNavbar
      title={t('title')}
      routes={navMenuItems}
      beta={false}
      data-test="main-layout-navbar"
      headerRightPart={<HeaderComponent key="headerRight" />}
      menuRightPart={<UserProfileActions key="menuRight" />}
    />
  )
}
