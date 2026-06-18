import { Edit, FileDownloadOutlined } from '@mui/icons-material'
import { Box, Divider, Grid, IconButton, Stack, Tooltip } from '@mui/material'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import BCTypography from '@/components/BCTypography'
import { useDownloadDocument } from '@/hooks/useDocuments'
import colors from '@/themes/base/colors'
import { ciApplicationPathwaySummaryColDefs } from '@/views/CarbonIntensity/components/_step2Schema'
import { CIApplicationStatusRenderer } from '@/utils/grid/cellRenderers'
import { constructAddress } from '@/utils/constructAddress'

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

const formatDateTime = (value) => {
  if (!value) return ''
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    return d.toLocaleString()
  } catch {
    return String(value)
  }
}

const formatBytes = (bytes) => {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const humanizeField = (field) =>
  String(field || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

const formatChangeValue = (value) => {
  if (value === null || value === undefined || value === '') return 'blank'
  return String(value)
}

const summarizeChangedFields = (changedFields = {}) =>
  Object.entries(changedFields)
    .map(([field, change]) => {
      const oldValue = formatChangeValue(change?.old)
      const newValue = formatChangeValue(change?.new)
      return `${humanizeField(field)}: ${oldValue} -> ${newValue}`
    })
    .join('; ')

const formatActionType = (value) => {
  switch (String(value || '').toUpperCase()) {
    case 'CREATE':
      return 'Added'
    case 'UPDATE':
      return 'Edited'
    case 'DELETE':
      return 'Deleted'
    default:
      return value || ''
  }
}

const Labelled = ({ label, value, dataTest }) => (
  <BCTypography variant="body2" data-test={dataTest}>
    <strong>{label}</strong> {value ?? ''}
  </BCTypography>
)

const getOrganizationAddress = (organization = {}) => {
  if (organization?.orgAddress) {
    return constructAddress(organization.orgAddress)
  }

  if (organization?.address) {
    return constructAddress(organization.address)
  }

  if (organization?.addressLine) {
    return organization.addressLine
  }

  return [organization.addressLine1, organization.cityProvinceCountry]
    .filter(Boolean)
    .join(', ')
}

/**
 * Consolidated read-only summary of a CI application — shown on the
 * post-submission view in place of the editable Steps 1–4 accordions.
 * Pulls every field straight off ``ciApplication`` so a single render
 * mirrors what the wizard captured.
 */
export const ApplicationSummary = ({
  ciApplication,
  currentUser,
  canEditDocuments = false,
  onEditDocuments,
  canEditPathways = false,
  onEditPathways
}) => {
  const { t } = useTranslation(['common', 'carbonIntensity'])
  if (!ciApplication) return null
  const pathwayGridRef = useRef(null)
  const downloadDocument = useDownloadDocument(
    'ci_application',
    ciApplication?.ciApplicationId
  )

  const org = ciApplication.organization || {}
  const currentUserFullName =
    [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') ||
    ''
  const signatureName =
    ciApplication.signatureUserDisplayName || ciApplication.signatureUser || ''
  const currentUsername =
    currentUser?.keycloakUsername || currentUser?.keycloak_username || ''
  const isCurrentUserSignatory = Boolean(
    (currentUserFullName && currentUserFullName === signatureName) ||
      (currentUsername && currentUsername === ciApplication.signatureUser)
  )
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
  const pathwayChangelog = ciApplication.pathwayChangelog || []
  const pathwayChangeLogs = [
    ...(ciApplication.pathwayChangeLogs || ciApplication.pathway_change_logs || [])
  ].sort((a, b) => {
    const aTime = new Date(a.changedAt || a.changed_at || 0).getTime()
    const bTime = new Date(b.changedAt || b.changed_at || 0).getTime()
    return aTime - bTime
  })
  const referencedPathway =
    pathways.find((pathway) => pathway?.fuelCode) || null
  const referencedFuelCode = referencedPathway?.fuelCode || null
  const referenceNumber =
    referencedFuelCode?.fuelCode ||
    (ciApplication.ciApplicationId ? `CI${ciApplication.ciApplicationId}` : '')
  const previousFuelCodeExpiryDate = formatDate(
    referencedPathway?.operatingDataTo ||
      referencedPathway?.operating_data_to ||
      referencedFuelCode?.expirationDate ||
      referencedFuelCode?.expiration_date
  )
  const hasConsultant =
    ciApplication.consultantName ||
    ciApplication.consultantCompany ||
    ciApplication.consultantEmail
  const signingAuthorityTitle = isCurrentUserSignatory
    ? currentUser?.title || ''
    : ''
  const signingAuthorityEmail = isCurrentUserSignatory
    ? currentUser?.email || ''
    : ''
  const organizationAddress = getOrganizationAddress(org)
  const pathwayColumnDefs = useMemo(
    () =>
      ciApplicationPathwaySummaryColDefs({
        optionsData: ciApplication?.optionsData,
        proposedFuelCodeEffectiveDate:
          ciApplication?.proposedFuelCodeEffectiveDate
      }),
    [ciApplication?.optionsData, ciApplication?.proposedFuelCodeEffectiveDate]
  )
  const pathwayQueryData = useMemo(
    () => ({
      data: { items: pathways },
      isLoading: false,
      isError: false,
      error: null
    }),
    [pathways]
  )
  const pathwayDefaultColDef = useMemo(
    () => ({
      sortable: false,
      filter: false,
      floatingFilter: false,
      resizable: true
    }),
    []
  )
  const pathwayGridOptions = useMemo(
    () => ({
      domLayout: 'autoHeight',
      headerHeight: 42,
      rowHeight: 44,
      animateRows: false
    }),
    []
  )
  const handleDownloadPathways = () => {
    pathwayGridRef.current?.api?.exportDataAsCsv({
      fileName: `ci_application_pathways_${ciApplication?.ciApplicationId || 'draft'}.csv`
    })
  }

  return (
    <BCBox data-test="ci-application-summary">
      {/* Org + facility */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ mb: 1, flexWrap: 'wrap' }}
          >
            <BCTypography
              variant="subtitle1"
              sx={{ fontWeight: 700, color: colors.primary.main }}
            >
              {org.name}
            </BCTypography>
            {ciApplication.status && (
              <Box sx={{ '& > span': { m: '0 !important' } }}>
                <CIApplicationStatusRenderer data={ciApplication} />
              </Box>
            )}
          </Stack>
          {organizationAddress && (
            <BCTypography variant="body2">{organizationAddress}</BCTypography>
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
              label={t('carbonIntensity:summary.referenceNumber')}
              value={referenceNumber}
              dataTest="ci-summary-reference-number"
            />
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
            <Labelled
              label={t('carbonIntensity:summary.previousFuelCodeExpiryDate')}
              value={previousFuelCodeExpiryDate}
              dataTest="ci-summary-previous-expiry-date"
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
          value={signatureName}
        />
        {signingAuthorityTitle && (
          <Labelled
            label={t('carbonIntensity:summary.titleLabel')}
            value={signingAuthorityTitle}
            dataTest="ci-summary-signing-title"
          />
        )}
        {signingAuthorityEmail && (
          <Labelled
            label={t('carbonIntensity:summary.emailLabel')}
            value={signingAuthorityEmail}
            dataTest="ci-summary-signing-email"
          />
        )}
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
      <BCBox
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: 2,
          mb: 2,
          height: 220,
          width: '60%',
          overflowY: 'auto'
        }}
        data-test="ci-summary-documents"
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{ mb: 1.5 }}
        >
          <BCTypography
            variant="body2"
            color="primary"
            sx={{ fontWeight: 600 }}
          >
            {t('carbonIntensity:step3.uploadedHeader')}
          </BCTypography>
          {canEditDocuments && onEditDocuments && (
            <Tooltip title={t('common:editBtn')}>
              <IconButton
                color="primary"
                aria-label={t('common:editBtn')}
                onClick={onEditDocuments}
                size="small"
                data-test="ci-summary-documents-edit-btn"
                sx={{ p: 0.5 }}
              >
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        {documents.length === 0 ? (
          <Box
            sx={{
              minHeight: '100%',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <BCTypography variant="body2" color="text.secondary">
              {t('carbonIntensity:step3.noDocuments')}
            </BCTypography>
          </Box>
        ) : (
          documents.map((d) => (
            <Box
              key={d.documentId}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 2fr) 96px 140px 120px',
                alignItems: 'center',
                gap: 2,
                py: 0.75,
                '&:not(:last-child)': {
                  borderBottom: 1,
                  borderColor: 'divider'
                }
              }}
              data-test="ci-summary-document-row"
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: 0
                }}
              >
                <BCTypography
                  component="span"
                  variant="body2"
                  sx={{ mr: 1, flexShrink: 0 }}
                >
                  •
                </BCTypography>
                <BCTypography
                  component="span"
                  variant="body2"
                  color="link"
                  onClick={() => {
                    downloadDocument(d.documentId, d.fileName)
                  }}
                  sx={{
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    '&:hover': { color: 'info.main' }
                  }}
                >
                  {d.fileName}
                </BCTypography>
              </Box>
              <BCTypography variant="body2" color="text.secondary">
                {formatBytes(d.fileSize)}
              </BCTypography>
              <BCTypography variant="body2" color="text.secondary">
                {d.createUser || ''}
              </BCTypography>
              <BCTypography variant="body2" color="text.secondary">
                {formatDate(d.createDate)}
              </BCTypography>
            </Box>
          ))
        )}
      </BCBox>

      <Divider sx={{ mb: 2 }} />

      {/* Pathways */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <BCTypography
          variant="subtitle1"
          sx={{ fontWeight: 700, color: colors.primary.main }}
        >
          {t('carbonIntensity:summary.pathwaysHeader')}
        </BCTypography>
        {canEditPathways && onEditPathways && (
          <Tooltip title={t('carbonIntensity:summary.editPathways')}>
            <IconButton
              color="primary"
              aria-label={t('carbonIntensity:summary.editPathways')}
              onClick={onEditPathways}
              size="small"
              data-test="ci-summary-pathways-edit-btn"
              sx={{ p: 0.5 }}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <BCButton
        type="button"
        variant="outlined"
        color="primary"
        size="medium"
        startIcon={
          <FileDownloadOutlined sx={{ fontSize: '1.25rem !important' }} />
        }
        onClick={handleDownloadPathways}
        sx={{ mb: 2 }}
        data-test="ci-summary-download-pathways-btn"
      >
        {t('carbonIntensity:summary.downloadPathways')}
      </BCButton>
      {pathways.length === 0 ? (
        <BCTypography variant="body2" color="text.secondary">
          {t('carbonIntensity:summary.noPathways')}
        </BCTypography>
      ) : (
        <BCBox
          data-test="ci-summary-pathways"
          sx={{ width: '100%', overflowX: 'auto' }}
        >
          <BCGridViewer
            gridRef={pathwayGridRef}
            gridKey={`ci-summary-pathways-${ciApplication?.ciApplicationId || 'new'}`}
            columnDefs={pathwayColumnDefs}
            queryData={pathwayQueryData}
            dataKey="items"
            defaultColDef={pathwayDefaultColDef}
            gridOptions={pathwayGridOptions}
            autoSizeStrategy={null}
            getRowId={(params) =>
              String(
                params.data?.pathwayId ||
                  `${params.data?.fuelCodeId || 'new'}-${params.data?.proposedCi || 'row'}`
              )
            }
            suppressPagination
            enablePageCaching={false}
            enableCopyButton={false}
            enableExportButton={false}
            enableResetButton={false}
          />
        </BCBox>
      )}
      {pathwayChangelog.length > 0 && (
        <BCBox mt={2} data-test="ci-summary-pathway-changelog">
          <BCTypography
            variant="subtitle2"
            sx={{ fontWeight: 700, color: colors.primary.main, mb: 1 }}
          >
            {t('carbonIntensity:summary.pathwayChangelog')}
          </BCTypography>
          <Stack spacing={0.5}>
            {pathwayChangelog.map((entry, index) => (
              <BCTypography
                key={`${entry.changedAt || entry.changed_at || 'change'}-${index}`}
                variant="body2"
              >
                {entry.event === 'pathway_changes_requested'
                  ? t('carbonIntensity:summary.pathwayChangesRequested')
                  : t('carbonIntensity:summary.supplementalPathwaysUpdated')}
                {` - ${formatDate(entry.changedAt || entry.changed_at)}`}
                {(entry.changedBy || entry.changed_by) &&
                  ` - ${entry.changedBy || entry.changed_by}`}
              </BCTypography>
            ))}
          </Stack>
        </BCBox>
      )}
      {pathwayChangeLogs.length > 0 && (
        <BCBox mt={2} data-test="ci-summary-pathway-change-log-details">
          <BCTypography
            variant="subtitle2"
            sx={{ fontWeight: 700, color: colors.primary.main, mb: 1 }}
          >
            {t('carbonIntensity:summary.pathwayChangeLogDetails')}
          </BCTypography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '120px 180px 180px minmax(240px, 1fr)',
              bgcolor: 'grey.100',
              borderBottom: 1,
              borderColor: 'divider',
              px: 1,
              py: 0.75,
              fontWeight: 700
            }}
          >
            <BCTypography variant="caption">
              {t('carbonIntensity:summary.changeAction')}
            </BCTypography>
            <BCTypography variant="caption">
              {t('carbonIntensity:summary.changeDate')}
            </BCTypography>
            <BCTypography variant="caption">
              {t('carbonIntensity:summary.changedBy')}
            </BCTypography>
            <BCTypography variant="caption">
              {t('carbonIntensity:summary.changedFields')}
            </BCTypography>
          </Box>
          {pathwayChangeLogs.map((entry) => (
            <Box
              key={
                `${entry.pathwayGroupUuid || entry.pathway_group_uuid}-${entry.changedAt || entry.changed_at}`
              }
              sx={{
                display: 'grid',
                gridTemplateColumns: '120px 180px 180px minmax(240px, 1fr)',
                borderBottom: 1,
                borderColor: 'divider',
                px: 1,
                py: 0.75,
                alignItems: 'start'
              }}
            >
              <BCTypography variant="body2">
                {formatActionType(entry.actionType || entry.action_type)}
              </BCTypography>
              <BCTypography variant="body2">
                {formatDateTime(entry.changedAt || entry.changed_at)}
              </BCTypography>
              <BCTypography variant="body2">
                {entry.changedBy || entry.changed_by || ''}
              </BCTypography>
              <BCTypography variant="body2">
                {summarizeChangedFields(
                  entry.changedFields || entry.changed_fields
                )}
              </BCTypography>
            </Box>
          ))}
        </BCBox>
      )}
    </BCBox>
  )
}

ApplicationSummary.displayName = 'ApplicationSummary'

export default ApplicationSummary
