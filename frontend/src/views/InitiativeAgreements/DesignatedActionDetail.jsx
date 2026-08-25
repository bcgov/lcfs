import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Divider } from '@mui/material'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import withRole from '@/utils/withRole'

import { InitiativeAgreementTabs } from './components/InitiativeAgreementTabs'

// Skeleton for the designated action detail page. The grid on the
// agreement page navigates here (#4896); the page's content — evidence
// requirements, submissions and the action workflow — arrives with #4840.
const DesignatedActionDetailBase = () => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const { initiativeAgreementId, designatedActionId } = useParams()

  return (
    <BCBox>
      <InitiativeAgreementTabs />
      <BCTypography
        variant="h5"
        color="primary"
        data-test="designated-action-detail-title"
      >
        {t('initiativeAgreement:actionDetail.title')}
        {` - DA${designatedActionId}-IA${initiativeAgreementId}`}
      </BCTypography>
      <Divider sx={{ mt: 2, mb: 3 }} />
      <BCTypography variant="body1" color="text.secondary">
        {t('initiativeAgreement:actionDetail.placeholder')}
      </BCTypography>
    </BCBox>
  )
}

export const DesignatedActionDetail = withRole(
  DesignatedActionDetailBase,
  [roles.ia_analyst, roles.ia_manager, roles.director],
  ROUTES.DASHBOARD
)
DesignatedActionDetail.displayName = 'DesignatedActionDetail'
