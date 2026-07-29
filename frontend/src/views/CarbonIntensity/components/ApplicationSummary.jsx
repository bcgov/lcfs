import { Edit, FileDownloadOutlined } from '@mui/icons-material'
import {
  Box,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Stack,
  Switch,
  Tooltip
} from '@mui/material'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import BCTypography from '@/components/BCTypography'
import { useDownloadDocument } from '@/hooks/useDocuments'
import colors from '@/themes/base/colors'
import {
  ciApplicationPathwayChangelogColDefs,
  ciApplicationPathwaySummaryColDefs
} from '@/views/CarbonIntensity/components/_step2Schema'
import { ProposedFuelPathwaysStep } from './ProposedFuelPathwaysStep'
import { CIApplicationStatusRenderer } from '@/utils/grid/cellRenderers'
import { constructAddress } from '@/utils/constructAddress'
import { exportRowsToXlsx } from './pathwayExport'

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

const PATHWAY_CHANGELOG_FIELD_MAP = {
  application_type_id: 'applicationTypeId',
  fuel_code_type_id: 'fuelCodeTypeId',
  operating_data_from: 'operatingDataFrom',
  operating_data_to: 'operatingDataTo',
  fuel_code_id: 'fuelCodeId',
  proposed_ci: 'proposedCi',
  fuel_type_id: 'fuelTypeId',
  feedstock: 'feedstock',
  feedstock_region: 'feedstockRegion',
  feedstock_transport_mode: 'feedstockTransportMode',
  feedstock_transport_distance: 'feedstockTransportDistance',
  coproducts: 'coproducts',
  finished_fuel_transport_mode: 'finishedFuelTransportMode',
  finished_fuel_transport_distance: 'finishedFuelTransportDistance'
}

const toPathwayChangelogRow = (snapshot = {}) => ({
  pathwayId: snapshot.pathway_id,
  pathwayGroupUuid: snapshot.pathway_group_uuid,
  applicationTypeId: snapshot.application_type_id,
  fuelCodeTypeId: snapshot.fuel_code_type_id,
  operatingDataFrom: snapshot.operating_data_from,
  operatingDataTo: snapshot.operating_data_to,
  fuelCodeId: snapshot.fuel_code_id,
  proposedCi:
    snapshot.proposed_ci !== null && snapshot.proposed_ci !== undefined
      ? Number(snapshot.proposed_ci)
      : snapshot.proposed_ci,
  fuelTypeId: snapshot.fuel_type_id,
  feedstock: snapshot.feedstock,
  feedstockRegion: snapshot.feedstock_region,
  feedstockTransportMode: snapshot.feedstock_transport_mode,
  feedstockTransportDistance: snapshot.feedstock_transport_distance,
  coproducts: snapshot.coproducts,
  finishedFuelTransportMode: snapshot.finished_fuel_transport_mode,
  finishedFuelTransportDistance: snapshot.finished_fuel_transport_distance
})

const toPlainPathwayChangelogRow = (pathway = {}, index) => ({
  ...pathway,
  id:
    pathway.pathwayId ||
    pathway.pathway_id ||
    pathway.groupUuid ||
    pathway.group_uuid ||
    `unchanged-pathway-${index}`,
  pathwayId: pathway.pathwayId || pathway.pathway_id,
  pathwayGroupUuid: pathway.groupUuid || pathway.group_uuid,
  applicationTypeId: pathway.applicationTypeId || pathway.application_type_id,
  fuelCodeTypeId: pathway.fuelCodeTypeId || pathway.fuel_code_type_id,
  operatingDataFrom: pathway.operatingDataFrom || pathway.operating_data_from,
  operatingDataTo: pathway.operatingDataTo || pathway.operating_data_to,
  fuelCodeId: pathway.fuelCodeId || pathway.fuel_code_id,
  proposedCi:
    pathway.proposedCi !== null && pathway.proposedCi !== undefined
      ? Number(pathway.proposedCi)
      : pathway.proposed_ci !== null && pathway.proposed_ci !== undefined
        ? Number(pathway.proposed_ci)
        : pathway.proposed_ci,
  fuelTypeId: pathway.fuelTypeId || pathway.fuel_type_id,
  feedstock: pathway.feedstock,
  feedstockRegion: pathway.feedstockRegion || pathway.feedstock_region,
  feedstockTransportMode:
    pathway.feedstockTransportMode || pathway.feedstock_transport_mode,
  feedstockTransportDistance:
    pathway.feedstockTransportDistance || pathway.feedstock_transport_distance,
  coproducts: pathway.coproducts,
  finishedFuelTransportMode:
    pathway.finishedFuelTransportMode || pathway.finished_fuel_transport_mode,
  finishedFuelTransportDistance:
    pathway.finishedFuelTransportDistance ||
    pathway.finished_fuel_transport_distance,
  actionType: '',
  updated: false,
  diff: []
})

const pathwayMatchKeys = (pathway = {}) => {
  const groupUuid =
    pathway.pathwayGroupUuid || pathway.groupUuid || pathway.group_uuid
  const pathwayId = pathway.pathwayId || pathway.pathway_id
  return [
    groupUuid ? `group:${groupUuid}` : null,
    pathwayId ? `id:${pathwayId}` : null
  ].filter(Boolean)
}

const pathwayChangeMatchKeys = (entry = {}) => {
  const before = entry.beforeSnapshot || entry.before_snapshot || {}
  const after = entry.afterSnapshot || entry.after_snapshot || {}
  const groupUuid =
    entry.pathwayGroupUuid ||
    entry.pathway_group_uuid ||
    before.pathway_group_uuid ||
    after.pathway_group_uuid

  return [
    groupUuid ? `group:${groupUuid}` : null,
    before.pathway_id ? `id:${before.pathway_id}` : null,
    after.pathway_id ? `id:${after.pathway_id}` : null
  ].filter(Boolean)
}

const changedFieldKeys = (changedFields = {}) =>
  Object.keys(changedFields)
    .map((field) => PATHWAY_CHANGELOG_FIELD_MAP[field] || field)
    .filter(Boolean)

const rowsForPathwayChange = (entry, index) => {
  const actionType = String(
    entry.actionType || entry.action_type || ''
  ).toUpperCase()
  const diff = changedFieldKeys(entry.changedFields || entry.changed_fields)
  const before = entry.beforeSnapshot || entry.before_snapshot
  const after = entry.afterSnapshot || entry.after_snapshot
  const keyBase = `${entry.pathwayGroupUuid || entry.pathway_group_uuid || index}-${entry.changedAt || entry.changed_at || index}`

  if (actionType === 'UPDATE') {
    return [
      {
        ...toPathwayChangelogRow(before),
        id: `${keyBase}-old`,
        actionType,
        updated: true,
        diff
      },
      {
        ...toPathwayChangelogRow(after),
        id: `${keyBase}-new`,
        actionType,
        updated: false,
        diff
      }
    ]
  }

  return [
    {
      ...toPathwayChangelogRow(actionType === 'DELETE' ? before : after),
      id: keyBase,
      actionType,
      updated: false,
      diff
    }
  ]
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
  pathwayEditorOptionsData,
  onSavePathways,
  onPathwayValidationError,
  isSavingPathways = false
}) => {
  const { t } = useTranslation(['common', 'carbonIntensity'])
  if (!ciApplication) return null
  const pathwayGridRef = useRef(null)
  const [showPathwayChangelog, setShowPathwayChangelog] = useState(false)
  const [isEditingPathways, setIsEditingPathways] = useState(false)
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
          ciApplication.facilityNameplateCapacityUnit || ''
        }`.trim()
      : ''

  const documents = ciApplication.documents || []
  const pathways = ciApplication.pathways || []
  const pathwayDescription = ciApplication.pathwayDescription?.trim()
  const pathwayChangeLogs = [
    ...(ciApplication.pathwayChangeLogs ||
      ciApplication.pathway_change_logs ||
      [])
  ].sort((a, b) => {
    const aTime = new Date(a.changedAt || a.changed_at || 0).getTime()
    const bTime = new Date(b.changedAt || b.changed_at || 0).getTime()
    return aTime - bTime
  })
  const latestPathwayChangelog = useMemo(() => {
    const groups = []
    const groupMap = new Map()

    pathwayChangeLogs.forEach((entry, index) => {
      const changedAt = entry.changedAt || entry.changed_at || ''
      const changedBy = entry.changedBy || entry.changed_by || ''
      const groupKey = `${changedAt}-${changedBy}`
      if (!groupMap.has(groupKey)) {
        const group = {
          key: groupKey || `pathway-change-${index}`,
          title: [formatDateTime(changedAt), changedBy]
            .filter(Boolean)
            .join(' - '),
          rows: [],
          changes: []
        }
        groupMap.set(groupKey, group)
        groups.push(group)
      }
      const rows = rowsForPathwayChange(entry, index)
      const group = groupMap.get(groupKey)
      group.rows.push(...rows)
      group.changes.push({
        keys: pathwayChangeMatchKeys(entry),
        rows
      })
    })

    const latestGroup = groups[groups.length - 1]
    if (!latestGroup) return { title: '', rows: [] }

    const changesByKey = new Map()
    latestGroup.changes.forEach((change) => {
      change.keys.forEach((key) => changesByKey.set(key, change))
    })
    const placedChanges = new Set()
    const rows = pathways.flatMap((pathway, index) => {
      const change = pathwayMatchKeys(pathway)
        .map((key) => changesByKey.get(key))
        .find(Boolean)
      if (change && !placedChanges.has(change)) {
        placedChanges.add(change)
        return change.rows
      }
      if (change) {
        return []
      }
      return [toPlainPathwayChangelogRow(pathway, index)]
    })
    latestGroup.changes
      .filter((change) => !placedChanges.has(change))
      .forEach((change) => {
        rows.push(...change.rows)
      })

    return {
      ...latestGroup,
      rows
    }
  }, [pathwayChangeLogs, pathways])
  const hasPathwayChangelogEntries = pathwayChangeLogs.length > 0
  const referencedPathway =
    pathways.find((pathway) => pathway?.fuelCode) || null
  const referencedFuelCode = referencedPathway?.fuelCode || null
  // Reference number is always the system-generated CI# increment, never a
  // referenced fuel code number (see #4657).
  const referenceNumber = ciApplication.ciApplicationId
    ? `CI${ciApplication.ciApplicationId}`
    : ''
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
  const pathwayChangelogColumnDefs = useMemo(
    () =>
      ciApplicationPathwayChangelogColDefs({
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
  const pathwayChangelogGridOptions = useMemo(
    () => ({
      domLayout: 'autoHeight',
      headerHeight: 42,
      rowHeight: 44,
      overlayNoRowsTemplate: t('carbonIntensity:summary.noPathwayChanges'),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      },
      enableCellTextSelection: true,
      ensureDomOrder: true,
      getRowStyle: (params) => {
        if (params.data?.actionType === 'DELETE') {
          return { backgroundColor: colors.alerts.error.background }
        }
        if (params.data?.actionType === 'CREATE') {
          return { backgroundColor: colors.alerts.success.background }
        }
      }
    }),
    [t]
  )
  const handleDownloadPathways = () => {
    const rows = []
    pathwayGridRef.current?.api?.forEachNodeAfterFilterAndSort((node) => {
      rows.push(node.data)
    })

    exportRowsToXlsx({
      rows: rows.length ? rows : pathways,
      columnDefs: pathwayColumnDefs,
      fileName: `ci_application_pathways_${ciApplication?.ciApplicationId || 'draft'}.xlsx`,
      sheetName: 'Pathways'
    })
  }
  const handleEditPathways = () => {
    setShowPathwayChangelog(false)
    setIsEditingPathways(true)
  }
  const handleSavePathways = async (payload) => {
    await onSavePathways?.(payload)
    setIsEditingPathways(false)
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
          <BCTypography
            variant="body2"
            sx={{ mt: 1, fontStyle: 'italic' }}
            data-test="ci-summary-org-info-confirmation"
          >
            "{t('carbonIntensity:step1.orgInfoConfirmationPrefix')}{' '}
            <a
              href={`mailto:${t('carbonIntensity:step1.orgInfoConfirmationEmail')}?subject=${encodeURIComponent(t('carbonIntensity:step1.orgInfoConfirmationEmailSubject'))}`}
            >
              {t('carbonIntensity:step1.orgInfoConfirmationEmail')}
            </a>
            "
          </BCTypography>
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

      {!isEditingPathways && pathwayDescription && (
        <>
          <BCBox
            data-test="ci-summary-pathway-description"
            sx={{ width: '100%', mb: 2 }}
          >
            <BCTypography
              variant="subtitle1"
              sx={{ fontWeight: 700, color: colors.primary.main, mb: 1 }}
            >
              {t('carbonIntensity:step2.descriptionLabel')}
            </BCTypography>
            <BCTypography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {pathwayDescription}
            </BCTypography>
          </BCBox>
          <Divider sx={{ mb: 2 }} />
        </>
      )}

      {/* Pathways */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <BCTypography
          variant="subtitle1"
          sx={{ fontWeight: 700, color: colors.primary.main }}
        >
          {t('carbonIntensity:summary.pathwaysHeader')}
        </BCTypography>
        {canEditPathways && (
          <Tooltip title={t('carbonIntensity:summary.editPathways')}>
            <IconButton
              color="primary"
              aria-label={t('carbonIntensity:summary.editPathways')}
              onClick={handleEditPathways}
              size="small"
              data-test="ci-summary-pathways-edit-btn"
              sx={{ p: 0.5 }}
              disabled={isEditingPathways}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      {!isEditingPathways && (
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
      )}
      {!isEditingPathways && hasPathwayChangelogEntries && (
        <FormControlLabel
          sx={{
            display: 'flex',
            width: 'fit-content',
            mb: 2,
            '& .MuiFormControlLabel-label': { mt: 0.8 }
          }}
          control={
            <Switch
              checked={showPathwayChangelog}
              onChange={(event) =>
                setShowPathwayChangelog(event.target.checked)
              }
              inputProps={{
                'aria-label': t(
                  'carbonIntensity:summary.pathwayChangelogToggle'
                )
              }}
              data-test="ci-summary-pathway-changelog-toggle"
            />
          }
          label={
            showPathwayChangelog
              ? t('carbonIntensity:summary.pathwayChangelogOn')
              : t('carbonIntensity:summary.pathwayChangelogOff')
          }
        />
      )}
      {isEditingPathways && (
        <BCBox data-test="ci-summary-pathways-editor">
          <ProposedFuelPathwaysStep
            ciApplication={ciApplication}
            optionsData={pathwayEditorOptionsData || ciApplication?.optionsData}
            onSave={handleSavePathways}
            onValidationError={onPathwayValidationError}
            isSaving={isSavingPathways}
            readOnly={false}
            secondaryAction={
              <BCButton
                type="button"
                variant="outlined"
                color="secondary"
                onClick={() => setIsEditingPathways(false)}
                disabled={isSavingPathways}
                data-test="ci-summary-pathways-cancel-btn"
              >
                {t('common:cancelBtn')}
              </BCButton>
            }
          />
        </BCBox>
      )}
      {!isEditingPathways &&
        !showPathwayChangelog &&
        (pathways.length === 0 ? (
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
        ))}
      {!isEditingPathways &&
        showPathwayChangelog &&
        hasPathwayChangelogEntries && (
          <BCBox mt={2} data-test="ci-summary-pathway-change-log-details">
            <BCGridViewer
              gridKey="ci-pathway-changelog-latest"
              columnDefs={pathwayChangelogColumnDefs}
              queryData={{
                data: { items: latestPathwayChangelog.rows },
                isLoading: false,
                isError: false,
                error: null
              }}
              dataKey="items"
              defaultColDef={pathwayDefaultColDef}
              gridOptions={pathwayChangelogGridOptions}
              autoSizeStrategy={null}
              getRowId={(params) => params.data.id}
              suppressPagination
              enablePageCaching={false}
              enableCopyButton={false}
              enableExportButton={false}
              enableResetButton={false}
            />
          </BCBox>
        )}
    </BCBox>
  )
}

ApplicationSummary.displayName = 'ApplicationSummary'

export default ApplicationSummary
