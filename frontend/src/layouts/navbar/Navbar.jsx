import React from 'react';
// @mui components
import BCNavbar from 'components/BCNavbar';
import HeaderComponent from 'layouts/navbar/components/HeaderComponent';
import MenuBarComponent from './components/MenuBarComponent';

// Nav Links
const routes = [
  { name: 'Dashboard', route: '/' },
  { name: 'Document', route: '/document' },
  { name: 'Transactions', route: '/transactions' },
  { name: 'Compliance Report', route: '/compliance-report' },
  { name: 'Organization', route: '/organization' },
  { name: 'Administration', route: '/administration/users' },
];

const Navbar = () => {
  return (
    <BCNavbar
      title="Low Carbon Fuel Standard"
      balance="50,000"
      organizationName="BC Government"
      routes={routes}
      beta={false}
      headerRightPart={<HeaderComponent key='headerRight' />}
      menuRightPart={<MenuBarComponent key='menRight' />}
    />
  )
}

export default Navbar