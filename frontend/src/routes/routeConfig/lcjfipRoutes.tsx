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

// Both the index and the form read Home > Jet fuel > LCJFIP application, as
// in the mock-ups (#5541). On the form, Crumb.tsx hides the structural
// lcjfip/applications segments and "Jet fuel" leads back to the index.
const applicationHandle = {
  title: 'LCJFIP application',
  crumb: () => 'LCJFIP application'
}

export const lcjfipRoutes: AppRouteObject[] = [
  {
    path: ROUTES.LCJFIP.MAIN,
    element: createGatedElement(LCJFIP),
    handle: applicationHandle
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
