import { AdminMenu } from '@/views/Admin/AdminMenu'
import ROUTES from '../routes'
import { Navigate } from 'react-router-dom'
import { ViewAuditLog } from '@/views/Admin/AdminMenu/components/ViewAuditLog'
import { AddEditUser } from '@/views/Users'
import UserDetailsCard from '@/views/Admin/AdminMenu/components/UserDetailsCard'

export const adminRoutes = [
  {
    path: ROUTES.ADMIN.MAIN,
    element: <Navigate to={ROUTES.ADMIN.USERS.LIST} replace />,
    handle: { title: 'Administration' }
  },
  {
    path: ROUTES.ADMIN.USERS.LIST,
    element: <AdminMenu tabIndex={0} />,
    handle: { title: 'Users' }
  },
  {
    path: ROUTES.ADMIN.USER_ACTIVITY,
    element: <AdminMenu tabIndex={1} />,
    handle: { title: 'User activity' }
  },
  {
    path: ROUTES.ADMIN.USER_LOGIN_HISTORY,
    element: <AdminMenu tabIndex={2} />,
    handle: { title: 'User login history' }
  },
  {
    path: ROUTES.ADMIN.AUDIT_LOG.LIST,
    element: <AdminMenu tabIndex={3} />,
    handle: { title: 'Audit log' }
  },
  {
    path: ROUTES.ADMIN.AUDIT_LOG.VIEW,
    element: <ViewAuditLog />,
    handle: { title: 'View audit log' }
  },
  {
    path: ROUTES.ADMIN.USERS.ADD,
    element: <UserDetailsCard addMode={true} userType="idir" />,
    handle: { title: 'Add user' }
  },
  {
    path: ROUTES.ADMIN.USERS.VIEW,
    element: <UserDetailsCard />,
    handle: { title: 'User profile' }
  }
]
