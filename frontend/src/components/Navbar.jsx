import { NavLink } from 'react-router-dom'
import * as Routes from '@/constants/routes'

const Navbar = () => {
  return (
    <div className="navbar">
      <NavLink to={Routes.DASHBOARD}>Home</NavLink>
      <NavLink to={Routes.ORGANIZATIONS}>Organizations</NavLink>
      <NavLink to={Routes.USERS}>Users</NavLink>
    </div>
  )
}

export default Navbar
