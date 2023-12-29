// @mui components
import BCNavbar from '@/components/BCNavbar'
import { HeaderComponent } from './HeaderComponent'
import { Logout } from './Logout'
import { ROUTES } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'

// Nav Links
const routes = [
  { name: 'Dashboard', route: ROUTES.DASHBOARD },
  { name: 'Transactions', route: ROUTES.TRANSACTIONS },
  { name: 'Compliance Report', route: ROUTES.REPORTS },
  { name: 'Organization', route: ROUTES.ORGANIZATIONS },
  { name: 'Administration', route: ROUTES.ADMIN }
]

export const Navbar = () => {
  const { data: currentUser } = useCurrentUser()

  return (
    <BCNavbar
      title="Low Carbon Fuel Standard"
      balance="50,000"
      organizationName={currentUser?.organization?.name}
      routes={routes}
      beta={true}
      headerRightPart={<HeaderComponent key="headerRight" />}
      menuRightPart={<Logout key="menRight" />}
    />
  )
}
