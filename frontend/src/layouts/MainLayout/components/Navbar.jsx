// @mui components
import BCNavbar from '@/components/BCNavbar'
import { HeaderComponent } from './HeaderComponent'
import { Logout } from './Logout'
import { ROUTES } from '@/constants/routes'
import { useUserStore } from '@/stores/useUserStore'

// Nav Links
const routes = [
  { name: 'Dashboard', route: ROUTES.DASHBOARD },
  { name: 'Transactions', route: ROUTES.TRANSACTIONS },
  { name: 'Compliance Report', route: ROUTES.REPORTS },
  { name: 'Organization', route: ROUTES.ORGANIZATIONS },
  { name: 'Administration', route: ROUTES.ADMIN }
]

export const Navbar = () => {
  const user = useUserStore((state) => state.user)

  return (
    <BCNavbar
      title="Low Carbon Fuel Standard"
      balance="50,000"
      organizationName={user?.organization?.name}
      routes={routes}
      beta={true}
      headerRightPart={<HeaderComponent key="headerRight" />}
      menuRightPart={<Logout key="menRight" />}
    />
  )
}
