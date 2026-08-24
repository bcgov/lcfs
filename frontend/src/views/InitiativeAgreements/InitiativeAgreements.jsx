import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import withRole from '@/utils/withRole'
import { Divider } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { InitiativeAgreementTabs } from './components/InitiativeAgreementTabs'

const InitiativeAgreementsBase = () => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])

  return (
    <BCBox>
      <InitiativeAgreementTabs />
      <BCTypography
        variant="h5"
        color="primary"
        data-test="initiative-agreements-title"
      >
        {t('InitiativeAgreements')}
      </BCTypography>
      <Divider sx={{ mt: 2, mb: 3 }} />
      {/* The agreements grid replaces this placeholder (#4833); column
          definitions are staged in ./_schema.tsx and the list hook in
          hooks/useInitiativeAgreements.ts. */}
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
