import logo from '../assets/images/gov3_bc_logo.png'
import Logout from './Logout'

const Header = () => {
  return (
    <div className="page-header">
      <div className="lcfs-banner">
        <div className="left">
          <a href="http://www.gov.bc.ca" rel="noopener noreferrer">
            <img src={logo} alt="Government of B.C." />
          </a>
        </div>
        <div className="right">
          <Logout/>
        </div>
      </div>
      <div className="title">
        <h1>Low Carbon Fuel Standard</h1>
      </div>
    </div>
  )
}
export default Header
