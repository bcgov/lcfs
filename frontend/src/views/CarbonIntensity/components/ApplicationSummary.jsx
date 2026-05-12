import { Box, Divider, Grid, Stack } from '@mui/material'
import { useTranslation } from 'react-i18next'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import colors from '@/themes/base/colors'

const formatDate = (value) => {
  if (!value) return ''
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    return d.toISOString().slice(0, 10)
  } catch {
    return String(value)
  }
}

const Labelled = ({ label, value, dataTest }) => (
  <BCTypography variant="body2" data-test={dataTest}>
    <strong>{label}</strong> {value ?? ''}
  </BCTypography>
)

/**
 * Consolidated read-only summary of a CI application — shown on the
 * post-submission view in place of the editable Steps 1–4 accordions.
 * Pulls every field straight off ``ciApplication`` so a single render
 * mirrors what the wizard captured.
 */
export const ApplicationSummary = ({ ciApplication }) => {
  const { t } = useTranslation(['carbonIntensity'])
  if (!ciApplication) return null

  const org = ciApplication.organization || {}
  const facilityLocationParts = [
    ciApplication.facilityCity,
    ciApplication.facilityProvinceState,
    ciApplication.facilityCountry
  ].filter(Boolean)
  const facilityLocation = facilityLocationParts.join(', ')
  const capacity =
    ciApplication.facilityNameplateCapacity != null
      ? `${ciApplication.facilityNameplateCapacity.toLocaleString()} ${
          ciApplication.facilityNameplateCapacityUnit?.name || ''
        }`.trim()
      : ''

  const documents = ciApplication.documents || []
  const pathways = ciApplication.pathways || []
  const hasConsultant =
    ciApplication.consultantName ||
    ciApplication.consultantCompany ||
    ciApplication.consultantEmail

  return (
    <BCBox data-test="ci-application-summary">
      {/* Org + facility */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <BCTypography
            variant="subtitle1"
            sx={{ fontWeight: 700, color: colors.primary.main, mb: 1 }}
          >
            {org.name}
          </BCTypography>
          {org.addressLine1 && (
            <BCTypography variant="body2">{org.addressLine1}</BCTypography>
          )}
          {org.cityProvinceCountry && (
            <BCTypography variant="body2">
              {org.cityProvinceCountry}
            </BCTypography>
          )}
          {org.phone && (
            <BCTypography variant="body2">{org.phone}</BCTypography>
          )}
          {org.email && (
            <BCTypography variant="body2">{org.email}</BCTypography>
          )}
        </Grid>
        <Grid item xs={12} md={6}>
          <Stack spacing={0.5}>
            <Labelled
              label={t('carbonIntensity:summary.facilityLocation')}
              value={facilityLocation}
              dataTest="ci-summary-facility-location"
            />
            <Labelled
              label={t('carbonIntensity:summary.facilityCapacity')}
              value={capacity}
              dataTest="ci-summary-facility-capacity"
            />
            <Labelled
              label={t('carbonIntensity:summary.proposedEffectiveDate')}
              value={formatDate(ciApplication.proposedFuelCodeEffectiveDate)}
              dataTest="ci-summary-effective-date"
            />
          </Stack>
        </Grid>
      </Grid>

      <Divider sx={{ mb: 2 }} />

      {/* Signing authority */}
      <BCTypography
        variant="subtitle1"
        sx={{ fontWeight: 700, color: colors.primary.main, mb: 1 }}
      >
        {t('carbonIntensity:summary.signingAuthorityHeader')}
      </BCTypography>
      <Stack spacing={0.5} sx={{ mb: 2 }} data-test="ci-summary-signing">
        <Labelled
          label={t('carbonIntensity:summary.signedLabel')}
          value={formatDate(ciApplication.signatureDateTime)}
        />
        <Labelled
          label={t('carbonIntensity:summary.signingAuthorityLabel')}
          value={ciApplication.signatureUser || ''}
        />
        {hasConsultant && (
          <BCTypography variant="body2" data-test="ci-summary-consultant">
            <strong>
              {t('carbonIntensity:summary.consultantContactLabel')}
            </strong>{' '}
            {[
              ciApplication.consultantName,
              ciApplication.consultantCompany,
              ciApplication.consultantEmail
            ]
              .filter(Boolean)
              .join(', ')}
          </BCTypography>
        )}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {/* Documents */}
      <BCTypography
        variant="subtitle1"
        sx={{ fontWeight: 700, color: colors.primary.main, mb: 1 }}
      >
        {t('carbonIntensity:summary.documentsHeader')}
      </BCTypography>
      {documents.length === 0 ? (
        <BCTypography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('carbonIntensity:step3.noDocuments')}
        </BCTypography>
      ) : (
        <Box
          component="ul"
          sx={{ pl: 3, mb: 2 }}
          data-test="ci-summary-documents"
        >
          {documents.map((d) => (
            <li key={d.documentId}>
              <BCTypography variant="body2">
                {d.fileName}
                {d.fileSize != null && (
                  <BCTypography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 2 }}
                  >
                    {Math.round(d.fileSize / 1024).toLocaleString()} KB
                  </BCTypography>
                )}
                {d.createUser && (
                  <BCTypography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 2 }}
                  >
                    {d.createUser}
                  </BCTypography>
                )}
                {d.createDate && (
                  <BCTypography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 2 }}
                  >
                    {formatDate(d.createDate)}
                  </BCTypography>
                )}
              </BCTypography>
            </li>
          ))}
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* Pathways */}
      <BCTypography
        variant="subtitle1"
        sx={{ fontWeight: 700, color: colors.primary.main, mb: 1 }}
      >
        {t('carbonIntensity:summary.pathwaysHeader')}
      </BCTypography>
      {pathways.length === 0 ? (
        <BCTypography variant="body2" color="text.secondary">
          {t('carbonIntensity:summary.noPathways')}
        </BCTypography>
      ) : (
        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            '& th, & td': {
              border: 1,
              borderColor: 'divider',
              p: 1,
              fontSize: '0.85rem',
              verticalAlign: 'top',
              textAlign: 'left'
            },
            '& th': { fontWeight: 600, backgroundColor: 'grey.50' }
          }}
          data-test="ci-summary-pathways"
        >
          <thead>
            <tr>
              <th>{t('carbonIntensity:step2.applicationType')}</th>
              <th>{t('carbonIntensity:summary.effectiveDateShort')}</th>
              <th>{t('carbonIntensity:summary.iteration')}</th>
              <th>{t('carbonIntensity:step2.proposedCi')}</th>
              <th>{t('carbonIntensity:step2.fuelType')}</th>
              <th>{t('carbonIntensity:step2.feedstock')}</th>
              <th>{t('carbonIntensity:step2.feedstockRegion')}</th>
              <th>{t('carbonIntensity:step2.feedstockTransportMode')}</th>
            </tr>
          </thead>
          <tbody>
            {pathways.map((p) => (
              <tr key={p.pathwayId || `${p.fuelCodeId}-${p.proposedCi}`}>
                <td>{p.applicationType?.type || ''}</td>
                <td>
                  {formatDate(
                    p.operatingDataFrom ||
                      ciApplication.proposedFuelCodeEffectiveDate
                  )}
                </td>
                <td>{p.fuelCode?.fuelCode || '—'}</td>
                <td>{p.proposedCi ?? ''}</td>
                <td>{p.fuelType?.fuelType || ''}</td>
                <td>{p.feedstock || ''}</td>
                <td>{p.feedstockRegion || ''}</td>
                <td>{p.feedstockTransportMode || ''}</td>
              </tr>
            ))}
          </tbody>
        </Box>
      )}
    </BCBox>
  )
}

ApplicationSummary.displayName = 'ApplicationSummary'

export default ApplicationSummary
