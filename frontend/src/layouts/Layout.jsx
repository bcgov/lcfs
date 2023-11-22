import React from 'react';

import { Outlet, useMatches, Link as RouterLink } from 'react-router-dom';
import DefaultNavbar from 'components/Navbars/DefaultNavbar';
import { Box, Breadcrumbs, Link } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

const Layout = () => {
  const matches = useMatches();
  const crumbs = matches
    .filter(match => Boolean(match.handle?.crumb))
    .map(match => ({
      label: match.handle.crumb(match.data),
      path: match.pathname,
    }));

  return (
    <>
      <DefaultNavbar />
      <Box p={4} pb={1}>
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
      </Box>
      <Box p={4}>
        <Outlet />
      </Box>
    </>
  );
};
export default Layout;
