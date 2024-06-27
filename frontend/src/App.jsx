import { RouterProvider, createBrowserRouter, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { MainLayout } from './layouts/MainLayout'
import { AdminMenu } from './views/Admin/AdminMenu'
import { ViewUser } from '@/views/Admin/AdminMenu/components/ViewUser'
import { ComplianceReports } from './views/ComplianceReports'
import { Dashboard } from './views/Dashboard'
import { FileSubmissions } from './views/FileSubmissions'
import { FuelCodes, AddFuelCode, ViewFuelCode } from './views/FuelCodes'
import { Notifications, NotificationSettings } from './views/Notifications'
import {
  Organizations,
  AddEditOrg,
  ViewOrganization
} from './views/Organizations'
import {
  Transactions,
  AddEditViewTransaction,
  ViewOrgTransaction
} from './views/Transactions'
import { AddEditViewTransfer } from './views/Transfers'
import { AddEditUser } from './views/Users'
import { ApiDocs } from './components/ApiDocs'
import { Login } from './components/Login'
import { NotFound } from './components/NotFound'
import ContactUs from './components/ContactUs'
import PublicLayout from './layouts/PublicLayout'
import { AddEditViewComplianceReport } from './views/ComplianceReports/components/AddEditViewComplianceReport'
import { AddEditNotionalTransfers } from './views/NotionalTransfers/AddEditNotionalTransfers'
import { AddEditOtherUses } from './views/OtherUses/AddEditOtherUses'
import { AddEditFinalSupplyEquipments } from './views/FinalSupplyEquipments/AddEditFinalSupplyEquipments'

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
        path: ROUTES.TRANSACTIONS_ADD,
        element: <AddEditViewTransaction />,
        handle: {
          title: 'New transaction',
          mode: 'add'
        }
      },
      {
        path: ROUTES.TRANSACTIONS_EDIT,
        element: <AddEditViewTransaction />,
        handle: {
          title: 'Edit transaction',
          mode: 'edit'
        }
      },
      {
        path: ROUTES.TRANSACTIONS_VIEW,
        element: <AddEditViewTransaction />,
        handle: {
          title: 'View transaction',
          mode: 'view'
        }
      },
      {
        path: ROUTES.TRANSFERS,
        element: <Navigate to={ROUTES.TRANSACTIONS} replace />,
        handle: { title: 'Transfers' }
      },
      {
        path: ROUTES.TRANSFERS_ADD,
        element: <AddEditViewTransfer />,
        handle: {
          title: 'New Transfer',
          mode: 'add',
          crumb: () => 'New Transfer'
        }
      },
      {
        path: ROUTES.TRANSFERS_EDIT,
        element: <AddEditViewTransfer />,
        handle: {
          title: 'Edit Transfer',
          mode: 'edit',
          crumb: () => 'Edit Transfer'
        }
      },
      {
        path: ROUTES.TRANSFERS_VIEW,
        element: <AddEditViewTransfer />,
        handle: {
          title: 'View Transfer',
          mode: 'view',
          crumb: () => 'View Transfer'
        }
      },
      {
        path: ROUTES.ORGANIZATION,
        element: <ViewOrganization />,
        handle: { title: 'Organization' }
      },
      {
        path: ROUTES.ORGANIZATION_ADDUSER,
        element: <AddEditUser />,
        handle: { title: 'New User' }
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
        handle: { title: 'Organizations', crumb: () => `Organizations` }
      },
      {
        path: ROUTES.ORGANIZATIONS_ADD,
        element: <AddEditOrg />,
        handle: { title: 'Add Organization' }
      },
      {
        path: ROUTES.ORGANIZATIONS_VIEW,
        element: <ViewOrganization />,
        handle: { title: 'View Organization' }
      },
      {
        path: ROUTES.ORGANIZATIONS_EDIT,
        element: <AddEditOrg />,
        handle: { title: 'Edit Organization' }
      },
      {
        path: ROUTES.ORGANIZATIONS_ADDUSER,
        element: <AddEditUser userType="bceid" />,
        handle: { title: 'New user' }
      },
      {
        path: ROUTES.ORGANIZATIONS_VIEWUSER,
        element: <ViewUser userType="bceid" />,
        handle: {
          crumb: () => 'Users',
          title: 'View user'
        }
      },
      {
        path: ROUTES.ORGANIZATIONS_EDITUSER,
        element: <AddEditUser userType="bceid" />,
        handle: {
          crumb: () => 'Users',
          title: 'Edit user'
        }
      },
      {
        path: ROUTES.REPORTS,
        element: <ComplianceReports />,
        handle: { title: 'Compliance reporting' }
      },
      {
        path: ROUTES.REPORTS_VIEW,
        element: <AddEditViewComplianceReport />,
        handle: { title: '' }
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
        handle: { title: 'Administration' }
      },
      {
        path: ROUTES.ADMIN_USERS,
        element: <AdminMenu tabIndex={0} />,
        handle: { title: 'Users' }
      },
      {
        path: ROUTES.ADMIN_USERACTIVITY,
        element: <AdminMenu tabIndex={1} />,
        handle: { title: 'User activity' }
      },
      {
        path: ROUTES.ADMIN_COMPLIANCE_REPORTING,
        element: <AdminMenu tabIndex={3} />,
        handle: { title: 'Compliance reporting' }
      },
      {
        path: ROUTES.ADMIN_USERS_ADD,
        element: <AddEditUser userType="idir" />,
        handle: { title: 'Add user' }
      },
      {
        path: ROUTES.ADMIN_USERS_VIEW,
        element: <ViewUser />,
        handle: { title: 'View user' }
      },
      {
        path: ROUTES.ADMIN_USERS_EDIT,
        element: <AddEditUser userType="idir" />,
        handle: { title: 'Edit user' }
      },
      {
        path: ROUTES.FUELCODES,
        element: <FuelCodes />,
        handle: { title: 'Fuel codes' }
      },
      {
        path: ROUTES.FUELCODES_ADD,
        element: <AddFuelCode />,
        handle: { title: 'Add Fuel Code' }
      },
      {
        path: ROUTES.FUELCODES_VIEW,
        element: <ViewFuelCode />,
        handle: { title: 'Fuel Code' }
      },
      {
        path: ROUTES.FILESUBMISSION,
        element: <FileSubmissions />,
        handle: { title: 'File Submissions' }
      },
      {
        path: ROUTES.TRANSACTION_ADD,
        element: <AddEditViewTransaction />,
        handle: {
          title: 'New Transaction',
          mode: 'add'
        }
      },
      {
        path: ROUTES.ADMIN_ADJUSTMENT_VIEW,
        element: <AddEditViewTransaction />,
        handle: {
          title: 'Admin Adjustment',
          mode: 'view'
        }
      },
      {
        path: ROUTES.ORG_ADMIN_ADJUSTMENT_VIEW,
        element: <ViewOrgTransaction />,
        handle: {
          title: 'Admin Adjustment'
        }
      },
      {
        path: ROUTES.ADMIN_ADJUSTMENT_EDIT,
        element: <AddEditViewTransaction />,
        handle: {
          title: 'Edit Admin Adjustment',
          mode: 'edit'
        }
      },
      {
        path: ROUTES.INITIATIVE_AGREEMENT_VIEW,
        element: <AddEditViewTransaction />,
        handle: {
          title: 'Initiative Agreement',
          mode: 'view'
        }
      },
      {
        path: ROUTES.ORG_INITIATIVE_AGREEMENT_VIEW,
        element: <ViewOrgTransaction />,
        handle: {
          title: 'Initiative Agreement'
        }
      },
      {
        path: ROUTES.INITIATIVE_AGREEMENT_EDIT,
        element: <AddEditViewTransaction />,
        handle: {
          title: 'Edit Initiative Agreement',
          mode: 'edit'
        }
      },
      {
        path: ROUTES.REPORTS_ADD_NOTIONAL_TRANSFERS,
        element: <AddEditNotionalTransfers />,
        handle: {
          title: 'New Notional Transfer',
          mode: 'add'
        }
      },
      {
        path: ROUTES.REPORTS_ADD_OTHER_USE_FUELS,
        element: <AddEditOtherUses />,
        handle: {
          title: 'New Fuel for Other Use',
          mode: 'add'
        }
      },
      {
        path: ROUTES.REPORTS_ADD_FINAL_SUPPLY_EQUIPMENTS,
        element: <AddEditFinalSupplyEquipments />,
        handle: {
          title: 'Final Supply Equipment',
          mode: 'add'
        }
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
