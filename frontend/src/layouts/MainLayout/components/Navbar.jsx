// @mui components
import BCNavbar from '@/components/BCNavbar'
import { HeaderComponent } from './HeaderComponent'
import { Logout } from './Logout'
import { ROUTES } from '@/constants/routes'

// Nav Links
const routes = [
  { name: 'Dashboard', route: ROUTES.DASHBOARD },
  { name: 'Transactions', route: ROUTES.TRANSACTIONS },
  { name: 'Compliance Report', route: ROUTES.REPORTS },
  { name: 'Organization', route: ROUTES.ORGANIZATIONS },
  { name: 'Administration', route: ROUTES.ADMIN }
]

const Navbar = () => {
  return (
    <BCNavbar
      title="Low Carbon Fuel Standard"
      balance="50,000"
      organizationName="BC Government"
      routes={routes}
      beta={true}
      headerRightPart={<HeaderComponent key="headerRight" />}
      menuRightPart={<Logout key="menRight" />}
    />
  )
}

export default Navbar
