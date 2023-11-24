import React from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Login from './components/Login';
import RequireAuth from './components/RequireAuth';
import * as appRoutes from './constants/routes';
// import Dashboard from './views/dashboard'
import DefaultNavbar from 'components/Navbars/DefaultNavbar';
import Layout from './layouts/Layout';
import { ViewUsers } from './views/viewUsers';
import UserTable from './components/Organizations/UsersTable';

const router = createBrowserRouter([
  {
    path: appRoutes.DASHBOARD,
    element: (
      <RequireAuth redirectTo={appRoutes.LOGIN}>
        {/* <Layout>
                 <Dashboard />
               </Layout> */}
        {/* Place the below Navbar later inside the Page Layout */}
        <DefaultNavbar />
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
    path: appRoutes.ORGANIZATIONS,
    element: (
      <RequireAuth redirectTo={appRoutes.LOGIN}>
        <Layout>
          <DefaultNavbar />
          <UserTable /> 
        </Layout>
      </RequireAuth>
    ),
  },
]);

const App = () => <RouterProvider router={router} />;

export default App;
