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
import { fuelCodeRoutes } from './routeConfig/fuelCodeRoutes'
import { publicPageRoutes } from './routeConfig/publicPageRoutes'
import { PublicPageLayout } from '@/layouts/PublicPageLayout'

const allRoutes = [
  ...publicRoutes,
  ...miscRoutes,
  ...adminRoutes,
  ...fuelCodeRoutes,
  ...organizationRoutes,
  ...transactionRoutes,
  ...transferRoutes,
  ...reportRoutes,
  ...notificationRoutes,
  ...publicPageRoutes
  // ... other route groups
]

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: publicRoutes
  },
  {
    element: <PublicPageLayout />,
    children: publicPageRoutes
  },
  {
    element: <MainLayout />,
    children: allRoutes
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
