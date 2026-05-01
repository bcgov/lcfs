import {
  CIApplications,
  EditViewCIApplication
} from '@/views/CarbonIntensity'
import ROUTES from '../routes'
import { AppRouteObject } from '../types'

export const ciApplicationRoutes: AppRouteObject[] = [
  {
    path: ROUTES.CI_APPLICATIONS.LIST,
    element: <CIApplications />,
    handle: { title: 'CI applications' }
  },
  {
    path: ROUTES.CI_APPLICATIONS.ADD,
    element: <EditViewCIApplication />,
    handle: { title: 'Carbon intensity application', mode: 'add' }
  },
  {
    path: ROUTES.CI_APPLICATIONS.EDIT,
    element: <EditViewCIApplication />,
    handle: { title: 'Carbon intensity application', mode: 'edit' }
  }
]
