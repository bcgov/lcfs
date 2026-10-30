import { createElement, type ComponentType } from 'react'
import { CIApplications, EditViewCIApplication } from '@/views/CarbonIntensity'
import { FEATURE_FLAGS } from '@/constants/config'
import { withFeatureFlag } from '@/utils/withFeatureFlag'
import ROUTES from '../routes'
import { AppRouteObject } from '../types'

const createGatedElement = (Component: ComponentType) =>
  createElement(
    withFeatureFlag(Component, FEATURE_FLAGS.CI_APPLICATIONS, ROUTES.DASHBOARD)
  )

// Keep the wizard mounted when saving a new draft redirects Add to Edit.
const editViewCIApplicationElement = createGatedElement(EditViewCIApplication)

export const ciApplicationRoutes: AppRouteObject[] = [
  {
    path: ROUTES.CI_APPLICATIONS.LIST,
    element: createGatedElement(CIApplications),
    handle: { title: 'CI applications' }
  },
  {
    path: ROUTES.CI_APPLICATIONS.ADD,
    element: editViewCIApplicationElement,
    handle: { title: 'Carbon intensity application', mode: 'add' }
  },
  {
    path: ROUTES.CI_APPLICATIONS.EDIT,
    element: editViewCIApplicationElement,
    handle: { title: 'Carbon intensity application', mode: 'edit' }
  }
]
