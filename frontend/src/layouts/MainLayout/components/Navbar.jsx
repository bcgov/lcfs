// @mui components
import BCNavbar from '@/components/BCNavbar'
import { HeaderComponent } from './HeaderComponent'
import { Logout } from './Logout'
import { ROUTES } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'

export const Navbar = () => {
  const { t } = useTranslation()
  const { data: currentUser } = useCurrentUser()
  // Nav Links
  const navMenuItems = useMemo(
    () =>
      currentUser.isGovernmentUser
        ? // IDIR Routes
          [
            { name: t('Dashboard'), route: ROUTES.DASHBOARD },
            { name: t('Organizations'), route: ROUTES.ORGANIZATIONS },
            { name: t('Transactions'), route: ROUTES.TRANSACTIONS },
            { name: t('ComplianceReporting'), route: ROUTES.REPORTS },
            { name: t('Administration'), route: ROUTES.ADMIN }
          ]
        : // BCeID Routes
          [
            { name: t('Dashboard'), route: ROUTES.DASHBOARD },
            { name: t('Transactions'), route: ROUTES.TRANSACTIONS },
            { name: t('ComplianceReporting'), route: ROUTES.REPORTS },
            { name: t('Organization'), route: ROUTES.ORGANIZATION }
          ],
    [currentUser, t]
  )

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
