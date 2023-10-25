import React from 'react';
import Header from './Header';
import Footer from './Footer';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  return (
    <div className="layout">
      <Header />
      <Navbar />
      <main className="page-content">{children}</main>
      <Footer />
    </div>
  );
};
export default Layout;
