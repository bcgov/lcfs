import { createBrowserRouter } from 'react-router-dom'
import { publicRoutes } from './routeConfig/publicRoutes'
import { adminRoutes } from './routeConfig/adminRoutes'
import { organizationRoutes } from './routeConfig/organizationRoutes'
import { transactionRoutes } from './routeConfig/transactionRoutes'
import { reportRoutes } from './routeConfig/reportRoutes'
import { MainLayout } from '@/layouts/MainLayout'
import { NotFound } from '@/components/NotFound'
import { ApiDocs } from '@/components/ApiDocs'
import { logout } from '@/utils/keycloak'
import ROUTES from './routes'
import { notificationRoutes } from './routeConfig/notificationRoutes'
import { miscRoutes } from './routeConfig/miscRoutes'
import { transferRoutes } from './routeConfig/transferRoutes'
import PublicLayout from '@/layouts/PublicLayout'

const allRoutes = [
  ...publicRoutes,
  ...miscRoutes,
  ...adminRoutes,
  ...organizationRoutes,
  ...transactionRoutes,
  ...transferRoutes,
  ...reportRoutes,
  ...notificationRoutes
]

function flattenRoutes(routes, basePath = '') {
  const flatRoutes = []

  routes.forEach((route) => {
    if (typeof route === 'string') {
      // Handle plain string paths
      flatRoutes.push({ path: route })
    } else if (route.path && typeof route.path === 'string') {
      // Handle objects with path and children
      const newBasePath = basePath + route.path

      flatRoutes.push({ ...route, path: newBasePath })

      Object.keys(route).forEach((key) => {
        if (typeof route[key] === 'object') {
          const nestedRoutes = flattenRoutes([route[key]], newBasePath)
          flatRoutes.push(...nestedRoutes)
        }
      })
    }
  })

  return flatRoutes
}
console.log(allRoutes)

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: publicRoutes
  },
  {
    element: <MainLayout />,
    children: [
      ...allRoutes
      // ... other route groups
    ]
  },
  {
    path: ROUTES.API_DOCS,
    element: <ApiDocs />,
    handle: { crumb: () => 'API Docs' }
  },
  {
    path: ROUTES.AUTH.LOG_OUT,
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
