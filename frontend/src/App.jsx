import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { MainLayout } from './layouts/MainLayout'
import { ApiDocs } from './views/ApiDocs'
import { AddEditUser } from './views/AddEditUser'
import { Admin } from './views/Admin'
import { AdminUsers } from './views/AdminUsers'
import { Dashboard } from './views/Dashboard'
import { EditOrg } from './views/EditOrg'
import { FileSubmission } from './views/FileSubmission'
import { FSE } from './views/FSE'
import { FuelCodes } from './views/FuelCodes'
import { Login } from './views/Login'
import { NewFuelCode } from './views/NewFuelCode'
import { NewOrg } from './views/NewOrg'
import { NewTransaction } from './views/NewTransaction'
import { NotFound } from './views/NotFound'
import { NotificationSettings } from './views/NotificationSettings'
import { Notifications } from './views/Notifications'
import { Organizations } from './views/Organizations'
import { Reports } from './views/Reports'
import { Transactions } from './views/Transactions'
import { UserActivity } from './views/UserActivity'
import { ViewOrg } from './views/ViewOrg'
import { ViewReport } from './views/ViewReport'
import { ViewTransaction } from './views/ViewTransaction'
import { ViewUser } from './views/ViewUser'

const router = createBrowserRouter([
  {
    name: 'Login',
    key: 'login',
    path: ROUTES.LOGIN,
    element: <Login />,
    handle: { crumb: () => 'Login' }
  },
  {
    element: <MainLayout />,
    children: [
      {
        path: ROUTES.DASHBOARD,
        children: [
          {
            path: '',
            element: <Dashboard />
          }
        ]
      },
      {
        path: ROUTES.TRANSACTIONS,
        element: <Transactions />
      },
      {
        path: ROUTES.TRANSACTIONS_NEW,
        element: <NewTransaction />
      },
      {
        path: ROUTES.TRANSACTIONS_VIEW,
        element: <ViewTransaction />
      },
      {
        path: ROUTES.ORGANIZATION,
        element: <ViewOrg />
      },
      {
        path: ROUTES.ORGANIZATION_NEWUSER,
        element: <AddEditUser />
      },
      {
        path: ROUTES.ORGANIZATION_VIEWUSER,
        element: <ViewUser />
      },
      {
        path: ROUTES.ORGANIZATION_EDITUSER,
        element: <AddEditUser />
      },
      {
        path: ROUTES.ORGANIZATIONS,
        element: <Organizations />
      },
      {
        path: ROUTES.ORGANIZATIONS_NEW,
        element: <NewOrg />
      },
      {
        path: ROUTES.ORGANIZATIONS_VIEW,
        element: <ViewOrg />
      },
      {
        path: ROUTES.ORGANIZATIONS_EDIT,
        element: <EditOrg />
      },
      {
        path: ROUTES.ORGANIZATIONS_NEWUSER,
        element: <AddEditUser />
      },
      {
        path: ROUTES.ORGANIZATIONS_VIEWUSER,
        element: <ViewUser />,
        handle: { crumb: () => 'Users' }
      },
      {
        path: ROUTES.ORGANIZATIONS_EDITUSER,
        element: <AddEditUser />,
        handle: { crumb: () => 'Users' }
      },
      {
        path: ROUTES.REPORTS,
        element: <Reports />
      },
      {
        path: ROUTES.REPORTS_VIEW,
        element: <ViewReport />
      },
      {
        path: ROUTES.NOTIFICATIONS,
        element: <Notifications />
      },
      {
        path: ROUTES.NOTIFICATIONS_SETTINGS,
        element: <NotificationSettings />
      },
      {
        path: ROUTES.ADMIN,
        element: <Admin />
      },
      {
        path: ROUTES.ADMIN_USERS,
        element: <AdminUsers />
      },
      {
        path: ROUTES.ADMIN_USERS_NEW,
        element: <AddEditUser userType="idir" />
      },
      {
        path: ROUTES.ADMIN_USERS_VIEW,
        element: <ViewUser />
      },
      {
        path: ROUTES.ADMIN_USERS_EDIT,
        element: <AddEditUser userType="idir" />
      },
      {
        path: ROUTES.ADMIN_USERACTIVITY,
        element: <UserActivity />
      },
      {
        path: ROUTES.FUELCODES,
        element: <FuelCodes />
      },
      {
        path: ROUTES.FUELCODES_NEW,
        element: <NewFuelCode />
      },
      {
        path: ROUTES.FSE,
        element: <FSE />
      },
      {
        path: ROUTES.FILESUBMISSION,
        element: <FileSubmission />
      }
    ]
  },
  {
    path: ROUTES.APIDOCS,
    element: <ApiDocs />,
    handle: { crumb: () => 'API Docs' }
  },
  {
    path: '*',
    element: <NotFound />
  }
])

const App = () => <RouterProvider router={router} />

export default App
