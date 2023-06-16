import React, { useEffect } from 'react';
import Header from './Header';
import Footer from './Footer';
import { useLocation } from 'react-router-dom';

const Layout = ({ children, logoutUri }) => {
  const location = useLocation();
  useEffect(() => {
    if (window.snowplow) {
      window.snowplow('refreshLinkClickTracking');
      window.snowplow('trackPageView');
    }
  }, [location]);

  return (
    <div className="layout">
      <Header logoutUri={logoutUri} />
      <main className="page-content">{children}</main>
      <Footer />
    </div>
  );
};
export default Layout;
