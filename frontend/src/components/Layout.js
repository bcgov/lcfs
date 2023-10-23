import React from 'react';
import Header from './Header';
import Footer from './Footer';

const Layout = ({ children, logoutUri }) => {
  return (
    <div className="layout">
      <Header logoutUri={logoutUri} />
      <main className="page-content">{children}</main>
      <Footer />
    </div>
  );
};
export default Layout;
