import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Divider, Paper, Stack } from '@mui/material'
import Grid2 from '@mui/material/Grid2'

import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import { SupportingDocumentSummary } from '@/views/SupportingDocuments/SupportingDocumentSummary'
import { roles } from '@/constants/roles'
import { useDocuments } from '@/hooks/useDocuments'
import { ROUTES } from '@/routes/routes'
import { constructAddress } from '@/utils/constructAddress'
import { dateFormatter } from '@/utils/formatters'
import withRole from '@/utils/withRole'

import { useGetInitiativeAgreement } from '@/hooks/useInitiativeAgreements'
import { InitiativeAgreementTabs } from './components/InitiativeAgreementTabs'

// The shared document machinery keys on this string for initiative agreements.
const PARENT_TYPE = 'initiativeAgreement'

const LabelValue = ({ label, value }) => (
  <BCTypography variant="body4">
    <strong>{label}</strong> {value || '—'}
  </BCTypography>
)

const InitiativeAgreementDetailBase = () => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const { initiativeAgreementId } = useParams()
  const [uploadOpen, setUploadOpen] = useState(false)

  const {
    data: agreement,
    isLoading,
    isError,
    error
  } = useGetInitiativeAgreement(initiativeAgreementId)

  const { data: documents, refetch: refetchDocuments } = useDocuments(
    PARENT_TYPE,
    initiativeAgreementId
  )

  if (isLoading) {
    return <Loading message={t('initiativeAgreement:loadingText')} />
  }

  if (isError || !agreement) {
    return (
      <BCBox>
        <InitiativeAgreementTabs />
        <BCAlert data-test="alert-box" severity="error">
          {error?.message || t('initiativeAgreement:detail.loadFailMsg')}
        </BCAlert>
      </BCBox>
    )
  }

  const organization = agreement.organization ?? {}
  const address = organization.orgAddress
    ? constructAddress(organization.orgAddress)
    : null
  // The wireframe's reference number is the agreement's own identifier.
  const referenceNumber = `IA${agreement.initiativeAgreementId}`

  return (
    <BCBox>
      <InitiativeAgreementTabs />

      <BCTypography
        variant="h5"
        color="primary"
        data-test="initiative-agreement-detail-title"
      >
        {t('initiativeAgreement:detail.title')}
        {agreement.iaCode ? ` - ${agreement.iaCode}` : ''}
      </BCTypography>
      <Divider sx={{ mt: 2, mb: 3 }} />

      <BCWidgetCard
        title={t('initiativeAgreement:detail.agreementHeader')}
        color="nav"
        data-test="initiative-agreement-header-section"
        content={
          <BCBox p={1}>
            <Grid2 container spacing={3}>
              <Grid2 size={{ xs: 12, md: 6 }}>
                <Stack spacing={0.5}>
                  <BCBox
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                  >
                    <BCTypography variant="h6" color="primary">
                      {organization.name}
                    </BCTypography>
                    {agreement.lifecycleStatus?.status && (
                      <BCBox
                        component="span"
                        data-test="agreement-status-chip"
                        sx={{
                          px: 1.5,
                          py: 0.25,
                          borderRadius: 4,
                          bgcolor: 'success.light',
                          color: 'success.contrastText',
                          fontSize: '0.8rem'
                        }}
                      >
                        {agreement.lifecycleStatus.status}
                      </BCBox>
                    )}
                  </BCBox>
                  {address && (
                    <BCTypography variant="body4">{address}</BCTypography>
                  )}
                  {organization.phone && (
                    <BCTypography variant="body4">
                      {organization.phone}
                    </BCTypography>
                  )}
                  {organization.email && (
                    <BCTypography variant="body4">
                      {organization.email}
                    </BCTypography>
                  )}
                </Stack>
              </Grid2>

              <Grid2 size={{ xs: 12, md: 6 }}>
                <Stack spacing={0.5}>
                  <LabelValue
                    label={t('initiativeAgreement:detail.referenceNumber')}
                    value={referenceNumber}
                  />
                  <LabelValue
                    label={t(
                      'initiativeAgreement:detail.initiativeAgreementCode'
                    )}
                    value={agreement.iaCode}
                  />
                  <LabelValue
                    label={t('initiativeAgreement:detail.startDate')}
                    value={dateFormatter({
                      value: agreement.agreementStartDate
                    })}
                  />
                  <LabelValue
                    label={t('initiativeAgreement:detail.endDate')}
                    value={dateFormatter({ value: agreement.agreementEndDate })}
                  />
                </Stack>
              </Grid2>
            </Grid2>

            <BCBox mt={3} data-test="initiative-agreement-brief-section">
              <BCTypography variant="h6" color="primary" mb={1}>
                {t('initiativeAgreement:detail.agreementBrief')}
              </BCTypography>
              {agreement.title && (
                <BCTypography variant="body4" component="p">
                  <strong>{agreement.title}</strong>
                </BCTypography>
              )}
              {agreement.projectDescription && (
                <BCTypography variant="body4" component="p" mt={1}>
                  {agreement.projectDescription}
                </BCTypography>
              )}
            </BCBox>

            <Paper
              variant="outlined"
              sx={{ p: 2, mt: 3 }}
              data-test="initiative-agreement-documents-section"
            >
              <BCBox
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <BCTypography variant="h6" color="primary">
                  {t('initiativeAgreement:detail.documents')}
                </BCTypography>
                {/* Upload is IDIR-only for this story; the shared upload
                    endpoint's role list is broader than this module. */}
                <Role roles={[roles.ia_analyst, roles.ia_manager, roles.director]}>
                  <BCTypography
                    component="button"
                    variant="body4"
                    color="link"
                    data-test="upload-documents-button"
                    onClick={() => setUploadOpen(true)}
                    sx={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    {t('initiativeAgreement:detail.manageDocuments')}
                  </BCTypography>
                </Role>
              </BCBox>
              {documents?.length ? (
                <SupportingDocumentSummary
                  parentID={initiativeAgreementId}
                  parentType={PARENT_TYPE}
                  data={documents}
                />
              ) : (
                <BCTypography variant="body4" color="text.secondary">
                  {t('initiativeAgreement:detail.noDocuments')}
                </BCTypography>
              )}
            </Paper>
          </BCBox>
        }
      />

      <DocumentUploadDialog
        open={uploadOpen}
        close={() => {
          setUploadOpen(false)
          refetchDocuments()
        }}
        parentType={PARENT_TYPE}
        parentID={initiativeAgreementId}
      />

      {/* Designated actions grid arrives with #4896, comments with #4897. */}
      <Paper
        variant="outlined"
        sx={{ p: 3, mt: 3 }}
        data-test="initiative-agreement-actions-section"
      >
        <BCTypography variant="h6" color="primary" mb={1}>
          {t('initiativeAgreement:detail.designatedActions')}
        </BCTypography>
        <BCTypography variant="body2" color="text.secondary">
          {t('initiativeAgreement:detail.sectionPlaceholder')}
        </BCTypography>
      </Paper>
    </BCBox>
  )
}

export const InitiativeAgreementDetail = withRole(
  InitiativeAgreementDetailBase,
  [roles.ia_proponent, roles.ia_analyst, roles.ia_manager, roles.director],
  ROUTES.DASHBOARD
)
InitiativeAgreementDetail.displayName = 'InitiativeAgreementDetail'
