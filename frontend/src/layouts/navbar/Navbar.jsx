// @mui components
import BCNavbar from '@/components/BCNavbar'
import HeaderComponent from '@/layouts/navbar/components/HeaderComponent'
import MenuBarComponent from './components/MenuBarComponent'
import useUserStore from '@/store/useUserStore'

// Nav Links
const routes = [
  { name: 'Dashboard', route: '/dashboard' },
  { name: 'Document', route: '/document' },
  { name: 'Transactions', route: '/transactions' },
  { name: 'Compliance Report', route: '/compliance-report' },
  { name: 'Organization', route: '/organization' },
  { name: 'Administration', route: '/admin' }
]

const Navbar = () => {
  const user = useUserStore((state) => state.user)

  return (
    <BCNavbar
      title="Low Carbon Fuel Standard"
      balance="50,000"
      organizationName={user?.organization?.name}
      routes={routes}
      beta={true}
      headerRightPart={<HeaderComponent key="headerRight" />}
      menuRightPart={<MenuBarComponent key="menRight" />}
    />
  )
}

export default Navbar
