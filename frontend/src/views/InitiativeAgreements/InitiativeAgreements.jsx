import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import withRole from '@/utils/withRole'
import { Divider } from '@mui/material'
import { useTranslation } from 'react-i18next'

const InitiativeAgreementsBase = () => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])

  return (
    <BCBox>
      <BCTypography
        variant="h5"
        color="primary"
        data-test="initiative-agreements-title"
      >
        {t('InitiativeAgreements')}
      </BCTypography>
      <Divider sx={{ mt: 2, mb: 3 }} />
      <BCTypography variant="body1" color="text.secondary">
        {t('initiativeAgreement:initiativeAgreementsPlaceholder')}
      </BCTypography>
    </BCBox>
  )
}

export const InitiativeAgreements = withRole(
  InitiativeAgreementsBase,
  [roles.ia_proponent, roles.ia_analyst, roles.ia_manager, roles.director],
  ROUTES.DASHBOARD
)
InitiativeAgreements.displayName = 'InitiativeAgreements'
