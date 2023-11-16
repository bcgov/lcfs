import React from 'react';

import { Outlet, useMatches, Link as RouterLink } from 'react-router-dom';
import DefaultNavbar from 'components/Navbars/DefaultNavbar';
import { Breadcrumbs, Link } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

const Layout = () => {
  const matches = useMatches();
  const crumbs = matches
    .filter(match => Boolean(match.handle?.crumb))
    .map(match => {
      console.log(match);
      return {
        label: match.handle.crumb(match.data),
        path: match.pathname,
      };
    });

  return (
    <>
      <DefaultNavbar />
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
        {crumbs.map((crumb, index) =>
          index + 1 !== crumbs.length ? (
            <Link
              key={crumb.path}
              component={RouterLink}
              to={crumb.path}
              disabled={true}
            >
              {crumb.label}
            </Link>
          ) : (
            <span key={crumb.path}>{crumb.label}</span>
          ),
        )}
      </Breadcrumbs>
      <Outlet />
    </>
  );
};
export default Layout;
