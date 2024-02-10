import { RouterProvider, createBrowserRouter, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { MainLayout } from './layouts/MainLayout'
import { AdminMenu } from './views/Admin/AdminMenu'
import { ViewUser } from '@/views/Admin/AdminMenu/components/ViewUser'
import {
  ComplianceReports,
  ViewComplianceReport
} from './views/ComplianceReports'
import { Dashboard } from './views/Dashboard'
import { FileSubmissions } from './views/FileSubmissions'
import { FuelCodes, AddFuelCode } from './views/FuelCodes'
import { Notifications, NotificationSettings } from './views/Notifications'
import {
  Organizations,
  AddOrganization,
  ViewOrganization,
  EditOrganization
} from './views/Organizations'
import { Transactions } from './views/Transactions'
import { ViewTransfer, AddEditTransfer } from './views/Transfers'
import { AddEditUser, UserActivity } from './views/Users'
import { ApiDocs } from './components/ApiDocs'
import { Login } from './components/Login'
import { NotFound } from './components/NotFound'
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
        handle: { title: 'Transactions', crumb: () => 'Transactions' }
      },
      {
        path: ROUTES.TRANSFERS_ADD,
        element: <AddEditTransfer />,
        handle: {
          title: 'New Transfer',
          crumb: () => 'New Transfer'
        }
      },
      {
        path: ROUTES.TRANSFERS_EDIT, // Use the dynamic route
        element: <AddEditTransfer />,
        handle: {
          title: 'Edit Transfer',
          // Dynamically set the breadcrumb title if needed
          crumb: () => `Edit Transfer`,
        },
      },
      {
        path: ROUTES.TRANSFERS_VIEW,
        element: <ViewTransfer />,
        handle: { title: 'View Transfer' }
      },
      {
        path: ROUTES.ORGANIZATION,
        element: <ViewOrganization />,
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
        element: <ViewOrganization />,
        handle: { title: 'View Organization' }
      },
      {
        path: ROUTES.ORGANIZATIONS_EDIT,
        element: <EditOrganization />,
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
        element: <ComplianceReports />,
        handle: { title: 'ComplianceReports' }
      },
      {
        path: ROUTES.REPORTS_VIEW,
        element: <ViewComplianceReport />,
        handle: { title: 'View Compliance Report' }
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
        path: ROUTES.FILESUBMISSION,
        element: <FileSubmissions />,
        handle: { title: 'File Submissions' }
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
