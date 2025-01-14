import { RouterProvider, createBrowserRouter, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { MainLayout } from './layouts/MainLayout'
import { AdminMenu } from './views/Admin/AdminMenu'
import { ViewAuditLog } from '@/views/Admin/AdminMenu/components/ViewAuditLog'
import { ViewUser } from '@/views/Admin/AdminMenu/components/ViewUser'
import { ComplianceReports } from './views/ComplianceReports'
import { Dashboard } from './views/Dashboard'
import { FileSubmissions } from './views/FileSubmissions'
import { NotificationMenu } from '@/views/Notifications/NotificationMenu'
import { FuelCodes, AddEditFuelCode } from './views/FuelCodes'
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
import PublicLayout from './layouts/PublicLayout'
import AddEditNotionalTransfersWithAccess from './views/NotionalTransfers/AddEditNotionalTransfers'
import AddEditOtherUsesWithAccess from './views/OtherUses/AddEditOtherUses'
import AddEditFinalSupplyEquipmentsWithAccess from './views/FinalSupplyEquipments/AddEditFinalSupplyEquipments'
import AddEditFuelSuppliesWithAccess from './views/FuelSupplies/AddEditFuelSupplies'
import AddEditFuelExportsWithAccess from './views/FuelExports/AddEditFuelExports'
import AddEditAllocationAgreementsWithAccess from './views/AllocationAgreements/AddEditAllocationAgreements'
import { logout } from '@/utils/keycloak.js'
import { CompareReports } from '@/views/CompareReports/CompareReports'
import { ComplianceReportViewSelector } from '@/views/ComplianceReports/ComplianceReportViewSelector.jsx'
import { useCurrentUser } from './hooks/useCurrentUser'
import Loading from './components/Loading'
import { Unauthorized } from './components/Unauthorized'

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
      },
      {
        path: '/unauthorized',
        element: <Unauthorized />
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
        handle: { title: 'Organizations', crumb: () => 'Organizations' }
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
        path: ROUTES.REPORTS_COMPARE,
        element: <CompareReports />,
        handle: { title: 'Compare reports' }
      },
      {
        path: ROUTES.REPORTS_VIEW,
        element: <ComplianceReportViewSelector />,
        handle: { title: '' }
      },
      {
        path: ROUTES.NOTIFICATIONS,
        element: <NotificationMenu tabIndex={0} />,
        handle: { title: 'Notifications' }
      },
      {
        path: ROUTES.NOTIFICATIONS_SETTINGS,
        element: <NotificationMenu tabIndex={1} />,
        handle: { title: 'Configure notifications' }
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
        path: ROUTES.ADMIN_USER_LOGIN_HISTORY,
        element: <AdminMenu tabIndex={2} />,
        handle: { title: 'User login history' }
      },
      {
        path: ROUTES.ADMIN_AUDIT_LOG,
        element: <AdminMenu tabIndex={3} />,
        handle: { title: 'Audit log' }
      },
      {
        path: ROUTES.ADMIN_AUDIT_LOG_VIEW,
        element: <ViewAuditLog />,
        handle: { title: 'View audit log' }
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
        element: <AddEditFuelCode />,
        handle: { title: 'Add Fuel Code' }
      },
      {
        path: ROUTES.FUELCODES_EDIT,
        element: <AddEditFuelCode />,
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
        element: <AddEditNotionalTransfersWithAccess />,
        handle: {
          title: 'Notional transfer of eligible renewable fuels',
          mode: 'add'
        }
      },
      {
        path: ROUTES.REPORTS_ADD_ALLOCATION_AGREEMENTS,
        element: <AddEditAllocationAgreementsWithAccess />,
        handle: {
          title: 'Allocation agreements',
          mode: 'add'
        }
      },
      {
        path: ROUTES.REPORTS_ADD_OTHER_USE_FUELS,
        element: <AddEditOtherUsesWithAccess />,
        handle: {
          title: 'Fuels for other use',
          mode: 'add'
        }
      },
      {
        path: ROUTES.REPORTS_ADD_FINAL_SUPPLY_EQUIPMENTS,
        element: <AddEditFinalSupplyEquipmentsWithAccess />,
        handle: {
          title: 'Final supply equipment',
          mode: 'add'
        }
      },
      {
        path: ROUTES.REPORTS_ADD_SUPPLY_OF_FUEL,
        element: <AddEditFuelSuppliesWithAccess />,
        handle: {
          title: 'Supply of fuel',
          mode: 'add'
        }
      },
      {
        path: ROUTES.REPORTS_ADD_FUEL_EXPORTS,
        element: <AddEditFuelExportsWithAccess />,
        handle: {
          title: 'Export fuels',
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
    path: ROUTES.LOG_OUT,
    loader: async () => {
      logout()
      return null
    }
  },
  {
    path: '*',
    element: <NotFound />
  }
])

const App = () => {
  const { isLoading } = useCurrentUser()

  if (isLoading) {
    return <Loading />
  }

  return <RouterProvider router={router} />
}

export default App
