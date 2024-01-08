import { RouterProvider, createBrowserRouter, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { MainLayout } from './layouts/MainLayout'
import { AddEditUser } from './views/AddEditUser'
import { AddFuelCode } from './views/AddFuelCode'
import { AddOrganization } from './views/AddOrganization'
import { AddTransaction } from './views/AddTransaction'
import { AdminMenu } from './views/AdminMenu'
import { ApiDocs } from './views/ApiDocs'
import { Dashboard } from './views/Dashboard'
import { FSE } from './views/FSE'
import { FileSubmission } from './views/FileSubmission'
import { FuelCodes } from './views/FuelCodes'
import { Login } from './views/Login'
import { NotFound } from './views/NotFound'
import { NotificationSettings } from './views/NotificationSettings'
import { Notifications } from './views/Notifications'
import { Organizations } from './views/Organizations'
import { Reports } from './views/Reports'
import { Transactions } from './views/Transactions'
import { UserActivity } from './views/UserActivity'
import { ViewOrg } from '@/views/Organizations/components/ViewOrg'
import { ViewReport } from './views/ViewReport'
import { ViewTransaction } from './views/ViewTransaction'
import { ViewUser } from '@/views/AdminMenu/components/ViewUser'
import ContactUs from './components/ContactUs'

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
        path: ROUTES.TRANSACTIONS_ADD,
        element: <AddTransaction />
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
        path: ROUTES.ORGANIZATION_ADDUSER,
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
        path: ROUTES.ORGANIZATIONS_ADD,
        element: <AddOrganization />
      },
      {
        path: ROUTES.ORGANIZATIONS_VIEW,
        element: <ViewOrg />
      },
      {
        path: ROUTES.ORGANIZATIONS_EDIT,
        element: <AddOrganization />
      },
      {
        path: ROUTES.ORGANIZATIONS_ADDUSER,
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
        element: <Navigate to={ROUTES.ADMIN_USERS} replace />
      },
      {
        path: ROUTES.ADMIN_USERS,
        element: <AdminMenu tabIndex={0} />
      },
      {
        path: ROUTES.ADMIN_ROLES,
        element: <AdminMenu tabIndex={1} />
      },
      {
        path: ROUTES.ADMIN_USERS_ADD,
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
        path: ROUTES.FUELCODES_ADD,
        element: <AddFuelCode />
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
    path: ROUTES.CONTACT_US,
    element: <ContactUs />,
    handle: { crumb: () => 'Contact Us' }
  },
  {
    path: '*',
    element: <NotFound />
  }
])

const App = () => <RouterProvider router={router} />

export default App
