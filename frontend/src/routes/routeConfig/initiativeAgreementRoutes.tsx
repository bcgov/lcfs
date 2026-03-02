import { InitiativeAgreements } from '@/views/InitiativeAgreements'
import ROUTES from '../routes'
import { AppRouteObject } from '../types'

export const initiativeAgreementRoutes: AppRouteObject[] = [
  {
    path: ROUTES.INITIATIVE_AGREEMENTS.LIST,
    element: <InitiativeAgreements />,
    handle: {
      title: 'Initiative agreements',
      crumb: () => 'Initiative agreements'
    }
  }
]
