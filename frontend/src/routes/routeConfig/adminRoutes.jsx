import React, { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import ROUTES from '../routes'

// Lazy-loaded components
const AdminMenu = lazy(() => import('@/views/Admin/AdminMenu'))
const ViewAuditLog = lazy(
  () => import('@/views/Admin/AdminMenu/components/ViewAuditLog')
)
const AddEditUser = lazy(() => import('@/views/Users'))
const ViewUser = lazy(
  () => import('@/views/Admin/AdminMenu/components/ViewUser')
)

// Utility function to wrap components with Suspense
const withSuspense = (Component, props = {}) => (
  <Suspense fallback={<div>Loading...</div>}>
    <Component {...props} />
  </Suspense>
)

export const adminRoutes = [
  {
    path: ROUTES.ADMIN,
    element: <Navigate to={ROUTES.ADMIN_USERS} replace />,
    handle: { title: 'Administration' }
  },
  {
    path: ROUTES.ADMIN.USERS.LIST,
    element: withSuspense(AdminMenu, { tabIndex: 0 }),
    handle: { title: 'Users' }
  },
  {
    path: ROUTES.ADMIN.USER_ACTIVITY,
    element: withSuspense(AdminMenu, { tabIndex: 1 }),
    handle: { title: 'User activity' }
  },
  {
    path: ROUTES.ADMIN.USER_LOGIN_HISTORY,
    element: withSuspense(AdminMenu, { tabIndex: 2 }),
    handle: { title: 'User login history' }
  },
  {
    path: ROUTES.ADMIN.AUDIT_LOG.LIST,
    element: withSuspense(AdminMenu, { tabIndex: 3 }),
    handle: { title: 'Audit log' }
  },
  {
    path: ROUTES.ADMIN.AUDIT_LOG.VIEW,
    element: withSuspense(ViewAuditLog),
    handle: { title: 'View audit log' }
  },
  {
    path: ROUTES.ADMIN.USERS.ADD,
    element: withSuspense(AddEditUser, { userType: 'idir' }),
    handle: { title: 'Add user' }
  },
  {
    path: ROUTES.ADMIN.USERS.VIEW,
    element: withSuspense(ViewUser),
    handle: { title: 'View user' }
  },
  {
    path: ROUTES.ADMIN.USERS.EDIT,
    element: withSuspense(AddEditUser, { userType: 'idir' }),
    handle: { title: 'Edit user' }
  }
]
