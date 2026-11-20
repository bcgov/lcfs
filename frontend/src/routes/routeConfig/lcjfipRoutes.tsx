import { createElement, type ComponentType } from 'react'
import { LCJFIP, LCJFIPApplication } from '@/views/LCJFIP'
import { FEATURE_FLAGS } from '@/constants/config'
import withFeatureFlag from '@/utils/withFeatureFlag'
import ROUTES from '../routes'
import { AppRouteObject } from '../types'

const createGatedElement = (Component: ComponentType) =>
  createElement(
    withFeatureFlag(Component, FEATURE_FLAGS.LCJFIP, ROUTES.DASHBOARD)
  )

// The application form's crumb reads Home > Jet fuel > LCJFIP application:
// Crumb.tsx hides the structural lcjfip/applications segments.
const applicationHandle = {
  title: 'LCJFIP application',
  crumb: () => 'LCJFIP application'
}

export const lcjfipRoutes: AppRouteObject[] = [
  {
    path: ROUTES.LCJFIP.MAIN,
    element: createGatedElement(LCJFIP),
    // The title is the breadcrumb's last crumb: Home > Jet fuel > LCJFIP.
    handle: {
      title: 'LCJFIP',
      crumb: () => 'LCJFIP'
    }
  },
  {
    path: ROUTES.LCJFIP.NEW_APPLICATION,
    element: createGatedElement(LCJFIPApplication),
    handle: applicationHandle
  },
  {
    path: ROUTES.LCJFIP.APPLICATION,
    element: createGatedElement(LCJFIPApplication),
    handle: applicationHandle
  }
]
