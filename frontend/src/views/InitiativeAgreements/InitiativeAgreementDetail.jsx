import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import withRole from '@/utils/withRole'
import { Divider, Paper } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { InitiativeAgreementTabs } from './components/InitiativeAgreementTabs'

const SectionPlaceholder = ({ titleKey, testId }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3 }} data-test={testId}>
      <BCTypography variant="h6" color="primary" mb={1}>
        {t(titleKey)}
      </BCTypography>
      <BCTypography variant="body2" color="text.secondary">
        {t('initiativeAgreement:detail.sectionPlaceholder')}
      </BCTypography>
    </Paper>
  )
}

// Static scaffolding for the initiative agreement detail page. Sections
// mirror the wireframes; data wiring arrives with the agreement-management
// API (#4839 detail page, #4840 designated action workflow).
const InitiativeAgreementDetailBase = () => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const { initiativeAgreementId } = useParams()

  return (
    <BCBox>
      <InitiativeAgreementTabs />
      <BCTypography
        variant="h5"
        color="primary"
        data-test="initiative-agreement-detail-title"
      >
        {t('initiativeAgreement:detail.title')}
        {initiativeAgreementId ? ` - IA${initiativeAgreementId}` : ''}
      </BCTypography>
      <Divider sx={{ mt: 2, mb: 3 }} />

      {/* Agreement header: organization block, status chip, reference
          number, IA code and agreement dates */}
      <SectionPlaceholder
        titleKey="initiativeAgreement:detail.agreementHeader"
        testId="initiative-agreement-header-section"
      />
      <SectionPlaceholder
        titleKey="initiativeAgreement:detail.agreementBrief"
        testId="initiative-agreement-brief-section"
      />
      {/* Attachments reuse the shared document components with the
          existing "initiativeAgreement" parent type */}
      <SectionPlaceholder
        titleKey="initiativeAgreement:detail.documents"
        testId="initiative-agreement-documents-section"
      />
      {/* Designated actions grid (ID, name, assigned analyst, last
          comment, compliance units to be issued) */}
      <SectionPlaceholder
        titleKey="initiativeAgreement:detail.designatedActions"
        testId="initiative-agreement-actions-section"
      />
      {/* Internal/public comments reuse components/Comments with
          entityType "initiativeAgreement" and commentMode "dual" */}
      <SectionPlaceholder
        titleKey="initiativeAgreement:detail.comments"
        testId="initiative-agreement-comments-section"
      />
    </BCBox>
  )
}

export const InitiativeAgreementDetail = withRole(
  InitiativeAgreementDetailBase,
  [roles.ia_proponent, roles.ia_analyst, roles.ia_manager, roles.director],
  ROUTES.DASHBOARD
)
InitiativeAgreementDetail.displayName = 'InitiativeAgreementDetail'
