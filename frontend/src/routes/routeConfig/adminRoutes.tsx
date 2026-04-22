import { AdminMenu, AdminLanding } from '@/views/Admin/AdminMenu'
import ROUTES from '../routes'
import { ViewAuditLog } from '@/views/Admin/AdminMenu/components/ViewAuditLog'
import UserDetailsCard from '@/views/Admin/AdminMenu/components/UserDetailsCard'
import { AppRouteObject } from '../types'
import { CONFIG } from '@/constants/config'

const normalizedEnvironment = (CONFIG.ENVIRONMENT || '').toLowerCase()
const isNonProdEnvironment = ['local', 'development', 'dev', 'test'].includes(
  normalizedEnvironment
)
const seededRoute: AppRouteObject[] = isNonProdEnvironment
  ? [
      {
        path: ROUTES.ADMIN.SEEDED_USER_ASSOCIATION,
        element: <AdminMenu />,
        handle: { title: 'Seeded user association' }
      }
    ]
  : []

export const adminRoutes: AppRouteObject[] = [
  {
    path: ROUTES.ADMIN.MAIN,
    element: <AdminLanding />,
    handle: { title: 'Administration' }
  },
  {
    path: ROUTES.ADMIN.USERS.LIST,
    element: <AdminMenu />,
    handle: { title: 'Users' }
  },
  {
    path: ROUTES.ADMIN.USER_ACTIVITY,
    element: <AdminMenu />,
    handle: { title: 'User activity' }
  },
  {
    path: ROUTES.ADMIN.USER_LOGIN_HISTORY,
    element: <AdminMenu />,
    handle: { title: 'User login history' }
  },
  {
    path: ROUTES.ADMIN.AUDIT_LOG.LIST,
    element: <AdminMenu />,
    handle: { title: 'Audit log' }
  },
  ...seededRoute,
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
  },
  {
    path: ROUTES.ADMIN.LOGIN_SCREEN_BACKGROUND,
    element: <AdminMenu />,
    handle: { title: 'Login screen background' }
  }
]
