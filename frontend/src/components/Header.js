import React from 'react';
import logo from '../styles/images/gov3_bc_logo.png';
import Logout from './Logout';

const Header = ({ logoutUri }) => {
  return (
    <div className="page-header">
      <div className="tfrs-banner">
        <div className="left">
          <a href="http://www.gov.bc.ca" rel="noopener noreferrer">
            <img src={logo} alt="Government of B.C." />
          </a>
        </div>
        <div className="right">
          <Logout logoutUri={logoutUri} />
        </div>
      </div>
      <div className="title">
        <h1>Low Carbon Fuel Standard</h1>
      </div>
    </div>
  );
};
export default Header;
