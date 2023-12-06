import React from 'react';

import { Outlet, useMatches, Link as RouterLink } from 'react-router-dom';
import { Paper, Grid, Breadcrumbs, Link, Container } from '@mui/material';
import BCBox from 'components/BCBox';
import Footer from 'components/Footer';
import BCTypography from 'components/BCTypography';

import Navbar from 'layouts/navbar/Navbar';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import RequireAuth from 'components/RequireAuth';
import * as appRoutes from 'constants/routes';

const Layout = ({ crumbs }) => {
  const matches = useMatches();
  const breadcrumbs = matches
    .filter(match => Boolean(match.handle?.crumb))
    .map(match => ({
      label: match.handle.crumb(match.data),
      path: match.pathname,
    }));

  return (
    <RequireAuth redirectTo={appRoutes.LOGIN}>
      <Container maxWidth='lg'
        sx={({ palette: { background } }) => ({
          padding: '1rem',
          background: background.paper,
          '@media (max-width: 920px)': {
            marginTop: '-2rem',
          }
        })}
        disableGutters={true}
      >
        <Grid
          item
          xs={12}
          sx={{
            maxHeight: '20vh',
            position: 'relative',
            top: 0,
            zIndex: 10, // Adjust the z-index if needed
          }}
        >
          <Navbar />
        </Grid>
        <Grid item my={12} lg={12}>
          <BCBox>
            {crumbs && (
              <Paper
                p={2}
                elevation={5}
                sx={{ padding: '8px', height: '50px' }}
              >
                <Breadcrumbs separator={<NavigateNextIcon fontSize='small' />}>
                  {breadcrumbs.map((crumb, index) =>
                    index + 1 !== breadcrumbs.length ? (
                      <BCTypography
                        key={crumb.path}
                        component={RouterLink}
                        to={crumb.path}
                        disabled={true}
                      >
                        {crumb.label}
                      </BCTypography>
                    ) : (
                      <BCTypography key={crumb.path}>{crumb.label}</BCTypography>
                    ),
                  )}
                </Breadcrumbs>
              </Paper>
            )}
            <BCBox py={4}>
              <Outlet />
              <Footer />
            </BCBox>
          </BCBox>
        </Grid>
      </Container>
    </RequireAuth>
  );
};
export default Layout;
