import React from 'react';
import { Paper } from '@mui/material';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

// Constants
import * as appRoutes from './constants/routes';

// Layouts
import Layout from './layouts/Layout';
import PublicLayout from './layouts/PublicLayout';
import UserTabPanel from 'layouts/admin/UserTabPanel';
import BCTypography from 'components/BCTypography';

// Components
import ContactUs from 'components/ContactUs';
import Login from './components/Login';

// Views
import { ViewUsers } from './views/viewUsers';
import ApiDocs from './components/ApiDocs';

const router = createBrowserRouter([
  {
    path: appRoutes.DASHBOARD,
    element: (
      <Layout>
        <BCTypography variant="h2" sx={{ textAlign: 'center' }}>
          Welcome to the Dashboard!
        </BCTypography>
      </Layout>
    ),
    handle: {
      crumb: () => 'Dashboard',
    },
  },
  {
    path: appRoutes.DOCS,
    element: (
      <ApiDocs />
    ),
    handle: {
      crumb: () => 'Docs',
    },
  },
  {
    path: appRoutes.LOGIN,
    element: <Login />,
  },
  {
    element: <Layout />, // wraps all routes listed in children. add in auth check here for convienience.
    children: [
      {
        path: appRoutes.ORGANIZATION,
        handle: {
          crumb: () => 'Organization',
        },
        children: [
          {
            index: true,
            element: <></>,
          },
          {
            path: appRoutes.VIEW_USER,
            element: <ViewUsers />,
            loader: data => data, // loader will pass data to useMatches
            handle: {
              crumb: data => `User: ${data.params.userID}`, // data from loader is passed into our crumb function so we can manipulate the output
            },
          },
        ],
      },
    ],
  },
  {
    element: <Layout />, // wraps all routes listed in children. add in auth check here for convienience.
    children: [
      {
        path: appRoutes.ADMINISTRATION,
        handle: {
          crumb: () => 'Administration',
        },
        children: [
          {
            index: true,
            element: <></>,
          },
          {
            path: appRoutes.ADMINISTRATION_USERS,
            element: <Paper elevation={5} sx={{ padding: "1rem", position: 'relative', minHeight: '80vh' }}>
              <UserTabPanel />
            </Paper>,
            // loader: data => data, // loader will pass data to useMatches
            handle: {
              crumb: data => `Users`, // data from loader is passed into our crumb function so we can manipulate the output
            },
          },
        ],
      },
    ],
  },
  // Public Routes Setup
  // This sets up a shared layout (PublicLayout) for all public-facing pages.
  {
    element: <PublicLayout />,
    children: [
      {
        path: appRoutes.CONTACT_US,
        element: <ContactUs />,
      },
    ],
  },
]);

const App = () => <RouterProvider router={router} />;

export default App;
