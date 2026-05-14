import {
  CIApplications,
  EditViewCIApplication
} from '@/views/CarbonIntensity'
import { FEATURE_FLAGS } from '@/constants/config'
import { withFeatureFlag } from '@/utils/withFeatureFlag'
import ROUTES from '../routes'
import { AppRouteObject } from '../types'

const CIApplicationsGated = withFeatureFlag(
  CIApplications,
  FEATURE_FLAGS.CI_APPLICATIONS,
  ROUTES.DASHBOARD
)
const EditViewCIApplicationGated = withFeatureFlag(
  EditViewCIApplication,
  FEATURE_FLAGS.CI_APPLICATIONS,
  ROUTES.DASHBOARD
)

export const ciApplicationRoutes: AppRouteObject[] = [
  {
    path: ROUTES.CI_APPLICATIONS.LIST,
    element: <CIApplicationsGated />,
    handle: { title: 'CI applications' }
  },
  {
    path: ROUTES.CI_APPLICATIONS.ADD,
    element: <EditViewCIApplicationGated />,
    handle: { title: 'Carbon intensity application', mode: 'add' }
  },
  {
    path: ROUTES.CI_APPLICATIONS.EDIT,
    element: <EditViewCIApplicationGated />,
    handle: { title: 'Carbon intensity application', mode: 'edit' }
  }
]
