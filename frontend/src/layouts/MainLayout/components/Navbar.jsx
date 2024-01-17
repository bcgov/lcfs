// @mui components
import BCNavbar from '@/components/BCNavbar'
import { HeaderComponent } from './HeaderComponent'
import { Logout } from './Logout'
import { ROUTES } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'

// Nav Links
// IDIR Routes
const idirRoutes = [
  { name: 'Dashboard', route: ROUTES.DASHBOARD },
  { name: 'Organizations', route: ROUTES.ORGANIZATIONS },
  { name: 'Transactions', route: ROUTES.TRANSACTIONS },
  { name: 'Compliance Reports', route: ROUTES.REPORTS },
  { name: 'File Submissions', route: ROUTES.FILESUBMISSION },
  { name: 'Administration', route: ROUTES.ADMIN }
]
// BCeID Routes
const bceidRoutes = [
  { name: 'Dashboard', route: ROUTES.DASHBOARD },
  { name: 'Transactions', route: ROUTES.TRANSACTIONS },
  { name: 'File Submissions', route: ROUTES.FILESUBMISSION },
  { name: 'Compliance Reports', route: ROUTES.REPORTS },
  { name: 'Organization', route: ROUTES.ORGANIZATION }
]

export const Navbar = () => {
  const { data: currentUser } = useCurrentUser()

  return (
    <BCNavbar
      title="Low Carbon Fuel Standard"
      balance="50,000"
      organizationName={currentUser?.organization?.name}
      routes={currentUser.is_government_user ? idirRoutes : bceidRoutes}
      beta={true}
      data-test="main-layout-navbar"
      headerRightPart={<HeaderComponent key="headerRight" />}
      menuRightPart={<Logout key="menRight" />}
    />
  )
}
