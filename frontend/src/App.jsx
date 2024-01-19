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
import PublicLayout from './layouts/PublicLayout'

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      {
        name: 'Login',
        key: 'login',
        path: ROUTES.LOGIN,
        element: <Login />,
        handle: { title: 'Login' }
      }
    ]
  },
  {
    element: <MainLayout />,
    children: [
      {
        path: ROUTES.DASHBOARD,
        children: [
          {
            path: '',
            element: <Dashboard />,
            handle: { title: 'Dashboard' }
          }
        ]
      },
      {
        path: ROUTES.TRANSACTIONS,
        element: <Transactions />,
        handle: { title: 'Transactions' }
      },
      {
        path: ROUTES.TRANSACTIONS_ADD,
        element: <AddTransaction />,
        handle: { title: 'Add Transaction' }
      },
      {
        path: ROUTES.TRANSACTIONS_VIEW,
        element: <ViewTransaction />,
        handle: { title: 'View Transactions' }
      },
      {
        path: ROUTES.ORGANIZATION,
        element: <ViewOrg />,
        handle: { title: 'View Organization' }
      },
      {
        path: ROUTES.ORGANIZATION_ADDUSER,
        element: <AddEditUser />,
        handle: { title: 'Add User' }
      },
      {
        path: ROUTES.ORGANIZATION_VIEWUSER,
        element: <ViewUser />,
        handle: { title: 'View User' }
      },
      {
        path: ROUTES.ORGANIZATION_EDITUSER,
        element: <AddEditUser />,
        handle: { title: 'Edit User' }
      },
      {
        path: ROUTES.ORGANIZATIONS,
        element: <Organizations />,
        handle: { title: 'Organizations' }
      },
      {
        path: ROUTES.ORGANIZATIONS_ADD,
        element: <AddOrganization />,
        handle: { title: 'Add Organization' }
      },
      {
        path: ROUTES.ORGANIZATIONS_VIEW,
        element: <ViewOrg />,
        handle: { title: 'View Organization' }
      },
      {
        path: ROUTES.ORGANIZATIONS_EDIT,
        element: <AddOrganization />,
        handle: { title: 'Edit Organization' }
      },
      {
        path: ROUTES.ORGANIZATIONS_ADDUSER,
        element: <AddEditUser />,
        handle: { title: 'Add Organization User' }
      },
      {
        path: ROUTES.ORGANIZATIONS_VIEWUSER,
        element: <ViewUser />,
        handle: {
          crumb: () => 'Users',
          title: 'View Organization User'
        }
      },
      {
        path: ROUTES.ORGANIZATIONS_EDITUSER,
        element: <AddEditUser />,
        handle: {
          crumb: () => 'Users',
          title: 'Edit Organization User'
        }
      },
      {
        path: ROUTES.REPORTS,
        element: <Reports />,
        handle: { title: 'Reports' }
      },
      {
        path: ROUTES.REPORTS_VIEW,
        element: <ViewReport />,
        handle: { title: 'View Report' }
      },
      {
        path: ROUTES.NOTIFICATIONS,
        element: <Notifications />,
        handle: { title: 'Notifications' }
      },
      {
        path: ROUTES.NOTIFICATIONS_SETTINGS,
        element: <NotificationSettings />,
        handle: { title: 'Notification Settings' }
      },
      {
        path: ROUTES.ADMIN,
        element: <Navigate to={ROUTES.ADMIN_USERS} replace />,
        handle: { title: 'Admin' }
      },
      {
        path: ROUTES.ADMIN_USERS,
        element: <AdminMenu tabIndex={0} />,
        handle: { title: 'Admin Users' }
      },
      {
        path: ROUTES.ADMIN_ROLES,
        element: <AdminMenu tabIndex={1} />,
        handle: { title: 'Admin Roles' }
      },
      {
        path: ROUTES.ADMIN_USERS_ADD,
        element: <AddEditUser userType="idir" />,
        handle: { title: 'Add Admin User' }
      },
      {
        path: ROUTES.ADMIN_USERS_VIEW,
        element: <ViewUser />,
        handle: { title: 'View Admin User' }
      },
      {
        path: ROUTES.ADMIN_USERS_EDIT,
        element: <AddEditUser userType="idir" />,
        handle: { title: 'Edit Admin User' }
      },
      {
        path: ROUTES.ADMIN_USERACTIVITY,
        element: <UserActivity />,
        handle: { title: 'Admin User Activity' }
      },
      {
        path: ROUTES.FUELCODES,
        element: <FuelCodes />,
        handle: { title: 'Fuel Codes' }
      },
      {
        path: ROUTES.FUELCODES_ADD,
        element: <AddFuelCode />,
        handle: { title: 'Add Fuel Code' }
      },
      {
        path: ROUTES.FSE,
        element: <FSE />,
        handle: { title: 'FSE' }
      },
      {
        path: ROUTES.FILESUBMISSION,
        element: <FileSubmission />,
        handle: { title: 'File Submission' }
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
