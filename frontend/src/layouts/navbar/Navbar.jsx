import React from 'react';
// @mui components
import BCNavbar from 'components/BCNavbar';
import HeaderComponent from 'layouts/navbar/components/HeaderComponent';
import MenuBarComponent from './components/MenuBarComponent';

// Nav Links
const routes = [
  { icon: 'home', name: 'Dashboard', route: '/' },
  { icon: 'folder', name: 'document', route: '/document' },
  { icon: 'account_balance', name: 'Transactions', route: '/transactions' },
  { icon: 'assessment', name: 'Compliance Report', route: '/compliance-report' },
  { icon: 'corporate_fare', name: 'Organization', route: '/organization' },
  { icon: 'admin_panel_settings', name: 'Administration', route: '/administration/users' },
];

const Navbar = () => {
  return (
    <BCNavbar
      title="Low Carbon Fuel Standard"
      balance="50,000"
      organizationName="BC Government"
      routes={routes}
      headerRightPart={<HeaderComponent key='headerRight' />}
      menuRightPart={<MenuBarComponent key='menRight' />}
    />
  )
}

export default Navbar