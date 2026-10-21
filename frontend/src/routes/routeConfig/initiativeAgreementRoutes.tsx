import { createElement, type ComponentType } from 'react'
import {
  DesignatedActionDetail,
  DesignatedActions,
  InitiativeAgreementDetail,
  InitiativeAgreements
} from '@/views/InitiativeAgreements'
import { FEATURE_FLAGS } from '@/constants/config'
import withFeatureFlag from '@/utils/withFeatureFlag'
import ROUTES from '../routes'
import { AppRouteObject } from '../types'

const createGatedElement = (Component: ComponentType) =>
  createElement(
    withFeatureFlag(
      Component,
      FEATURE_FLAGS.INITIATIVE_AGREEMENTS,
      ROUTES.DASHBOARD
    )
  )

export const initiativeAgreementRoutes: AppRouteObject[] = [
  {
    path: ROUTES.INITIATIVE_AGREEMENTS.LIST,
    element: createGatedElement(InitiativeAgreements),
    handle: {
      title: 'Initiative agreements',
      crumb: () => 'Initiative agreements'
    }
  },
  {
    path: ROUTES.INITIATIVE_AGREEMENTS.ACTIONS_LIST,
    element: createGatedElement(DesignatedActions),
    handle: {
      title: 'Designated actions',
      crumb: () => 'Designated actions'
    }
  },
  {
    path: ROUTES.INITIATIVE_AGREEMENTS.VIEW,
    element: createGatedElement(InitiativeAgreementDetail),
    handle: {
      title: 'Initiative agreement',
      crumb: () => 'Initiative agreement'
    }
  },
  {
    path: ROUTES.INITIATIVE_AGREEMENTS.ACTION_VIEW,
    element: createGatedElement(DesignatedActionDetail),
    handle: {
      title: 'Designated action',
      crumb: () => 'Designated action'
    }
  }
]
