import { Navigate } from 'react-router-dom'
import BCTypography from '@/components/BCTypography'
// Constants
import { appRoutes } from '@/constants/routes'
// React components
import ApiDocs from '@/components/ApiDocs'
import Login from '@/layouts/authentication/components/Login'
import OrganizationLayout from '@/layouts/organization/OrganizationLayout'
import { ViewUsers } from '@/views/viewUsers'
import { EditUser } from '@/views/editUser'
import Layout from '@/layouts/Layout'
import AdminUsersLayout from '@/layouts/admin/AdminUsersLayout'
import PublicLayout from '@/layouts/PublicLayout'
import ContactUs from '@/components/ContactUs'

// TODO: error bound component needs to be created
export const routes = [
  {
    name: 'Login',
    key: 'login',
    path: appRoutes.login.main,
    element: <Login />,
    handle: { crumb: () => 'Login' }
  },
  // Contact-Us page
  {
    path: appRoutes.contactUs.main,
    element: <PublicLayout crumbs />,
    children: [
      {
        path: '',
        element: <ContactUs />
      }
    ]
  },
  // Main application pages
  {
    path: '/',
    element: <Layout crumbs />,
    children: [
      {
        path: '',
        element: <Navigate to={appRoutes.dashboard.main} replace />
      },
      // Docs
      {
        path: appRoutes.docs.main,
        element: <ApiDocs />,
        handle: { crumb: () => 'API Docs' }
      },
      // Dashboard
      {
        path: appRoutes.dashboard.main,
        handle: { crumb: () => 'Dashboard' },
        children: [
          {
            path: '',
            element: (
              <BCTypography variant="h4" sx={{ textAlign: 'center' }}>
                Welcome to the Dashboard!
              </BCTypography>
            )
          }
        ]
      },
      // Document
      {
        path: appRoutes.document.main,
        handle: { crumb: () => 'Document' },
        children: [
          {
            path: '',
            element: (
              <BCTypography variant="h4" sx={{ textAlign: 'center' }}>
                Welcome to the Document!
              </BCTypography>
            )
          }
        ]
      },
      // Transactions
      {
        path: appRoutes.transactions.main,
        handle: { crumb: () => 'Transactions' },
        children: [
          {
            path: '',
            element: (
              <BCTypography variant="h4" sx={{ textAlign: 'center' }}>
                Welcome to the Transactions!
              </BCTypography>
            )
          }
        ]
      },
      // Compliance Report
      {
        path: appRoutes.complianceReport.main,
        handle: { crumb: () => 'Compliance Report' },
        children: [
          {
            path: '',
            element: (
              <BCTypography variant="h4" sx={{ textAlign: 'center' }}>
                Welcome to the Compliance Report!
              </BCTypography>
            )
          }
        ]
      },
      // Organization pages for IDIR User
      {
        path: appRoutes.organization.main,
        handle: { crumb: () => 'Organization' },
        children: [
          {
            path: '',
            element: <OrganizationLayout /> // redirect to users if no path is provided
          },
          {
            path: appRoutes.organization.users,
            element: <ViewUsers />,
            handle: { crumb: () => 'Users' }
          },
          {
            path: appRoutes.organization.edit,
            element: <ViewUsers />,
            handle: { crumb: () => 'Users' }
          }
        ]
      },
      // Administration and it's child pages for IDIR User
      {
        path: appRoutes.admin.main,
        handle: { crumb: () => 'Administration' },
        children: [
          {
            path: '',
            element: <Navigate to={appRoutes.admin.users} replace />,
            handle: { crumb: () => 'Users' }
          },
          {
            path: appRoutes.admin.users,
            element: <AdminUsersLayout />,
            handle: { crumb: () => 'Users' }
          },
          {
            path: appRoutes.admin.createUser,
            element: <EditUser userType="idir" />,
            handle: { crumb: () => 'Create User' }
          }
        ]
      }
    ]
  }
]
