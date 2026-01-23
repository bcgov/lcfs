import { Login } from '@/components/Login'
import ROUTES from '../routes'
import { Unauthorized } from '@/components/Unauthorized'
import { AppRouteObject } from '../types'

export const publicRoutes: AppRouteObject[] = [
  {
    name: 'Login',
    key: 'login',
    path: ROUTES.AUTH.LOGIN,
    element: <Login />,
    handle: { title: 'Login' }
  },
  {
    path: ROUTES.AUTH.UNAUTHORIZED,
    element: <Unauthorized />
  }
]
