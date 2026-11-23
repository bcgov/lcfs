import { createElement, type ComponentType } from 'react'
import { LCJFIP } from '@/views/LCJFIP'
import { FEATURE_FLAGS } from '@/constants/config'
import withFeatureFlag from '@/utils/withFeatureFlag'
import ROUTES from '../routes'
import { AppRouteObject } from '../types'

const createGatedElement = (Component: ComponentType) =>
  createElement(
    withFeatureFlag(Component, FEATURE_FLAGS.LCJFIP, ROUTES.DASHBOARD)
  )

export const lcjfipRoutes: AppRouteObject[] = [
  {
    path: ROUTES.LCJFIP.MAIN,
    element: createGatedElement(LCJFIP),
    // The title is the breadcrumb's last crumb: Home > Jet fuel > LCJFIP.
    handle: {
      title: 'LCJFIP',
      crumb: () => 'LCJFIP'
    }
  }
]
