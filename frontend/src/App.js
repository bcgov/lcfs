import React from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Login from './components/Login';
import RequireAuth from './components/RequireAuth';
import * as appRoutes from './constants/routes';
import Layout from './layouts/Layout';
import { ViewUsers } from './views/viewUsers';
import { Paper } from '@mui/material';
import { BCTypography } from 'components/BCTypography';
import UserTabPanel from 'layouts/admin/UserTabPanel';
import NewUser from './components/Adminstrator/NewUser';

const router = createBrowserRouter([
  {
    path: appRoutes.DASHBOARD,
    element: (
      <RequireAuth redirectTo={appRoutes.LOGIN}>
        <Layout>
          <BCTypography variant="h2" sx={{ textAlign: 'center' }}>
            Welcome to the Dashboard!
          </BCTypography>
        </Layout>
      </RequireAuth>
    ),
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
      {
        path: appRoutes.USERS,
        handle: {
          crumb: () => 'Users',
        },
        children: [
          {
            index: true,
            element: <></>,
          },
          {
            path: appRoutes.CREATE_USER,
            element:<Paper elevation={5} sx={{ padding: '1rem', position: 'relative', minHeight: '80vh' }}>
                   <NewUser />
                 </Paper>
            , 
            handle: {
               enter: ({ params }) => console.log('Matched route:', '/users/create', 'with params:', params),
              crumb: data => `NewUser`, // data from loader is passed into our crumb function so we can manipulate the output
            },
          },
        ],
      }, 
    ],
  },
]);

const App = () => <RouterProvider router={router} />;

export default App;
