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

const InitiativeAgreementsGated = withFeatureFlag(
  InitiativeAgreements,
  FEATURE_FLAGS.INITIATIVE_AGREEMENTS,
  ROUTES.DASHBOARD
)
const InitiativeAgreementDetailGated = withFeatureFlag(
  InitiativeAgreementDetail,
  FEATURE_FLAGS.INITIATIVE_AGREEMENTS,
  ROUTES.DASHBOARD
)
const DesignatedActionDetailGated = withFeatureFlag(
  DesignatedActionDetail,
  FEATURE_FLAGS.INITIATIVE_AGREEMENTS,
  ROUTES.DASHBOARD
)
const DesignatedActionsGated = withFeatureFlag(
  DesignatedActions,
  FEATURE_FLAGS.INITIATIVE_AGREEMENTS,
  ROUTES.DASHBOARD
)

export const initiativeAgreementRoutes: AppRouteObject[] = [
  {
    path: ROUTES.INITIATIVE_AGREEMENTS.LIST,
    element: <InitiativeAgreementsGated />,
    handle: {
      title: 'Initiative agreements',
      crumb: () => 'Initiative agreements'
    }
  },
  {
    path: ROUTES.INITIATIVE_AGREEMENTS.ACTIONS_LIST,
    element: <DesignatedActionsGated />,
    handle: {
      title: 'Designated actions',
      crumb: () => 'Designated actions'
    }
  },
  {
    path: ROUTES.INITIATIVE_AGREEMENTS.VIEW,
    element: <InitiativeAgreementDetailGated />,
    handle: {
      title: 'Initiative agreement',
      crumb: () => 'Initiative agreement'
    }
  },
  {
    path: ROUTES.INITIATIVE_AGREEMENTS.ACTION_VIEW,
    element: <DesignatedActionDetailGated />,
    handle: {
      title: 'Designated action',
      crumb: () => 'Designated action'
    }
  }
]
