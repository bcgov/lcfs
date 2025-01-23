import React, { lazy, Suspense } from 'react'
import ROUTES from '../routes'

// Lazy-loaded components
const Login = lazy(() => import('@/components/Login'))
const Unauthorized = lazy(() => import('@/components/Unauthorized'))

// Utility function to wrap components with Suspense
const withSuspense = (Component, props = {}) => (
  <Suspense fallback={<div>Loading...</div>}>
    <Component {...props} />
  </Suspense>
)

export const publicRoutes = [
  {
    name: 'Login',
    key: 'login',
    path: ROUTES.AUTH.LOGIN,
    element: withSuspense(Login),
    handle: { title: 'Login' }
  },
  {
    path: ROUTES.AUTH.UNAUTHORIZED,
    element: withSuspense(Unauthorized)
  }
]
