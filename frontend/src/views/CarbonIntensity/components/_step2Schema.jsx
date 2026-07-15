import {
  ActionsRenderer,
  AutocompleteCellEditor,
  DateEditor,
  RequiredHeader
} from '@/components/BCDataGrid/components'
import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { changelogCellStyle } from '@/utils/grid/changelogCellStyle'
import colors from '@/themes/base/colors'
import BCTypography from '@/components/BCTypography'
import i18n from '@/i18n'

const APPLICATION_TYPE_RENEWAL = 'Renewal'

export const isRenewalRow = (data, applicationTypes) => {
  if (!data?.applicationTypeId) return false
  const match = applicationTypes?.find(
    (t) => t.pathwayApplicationTypeId === data.applicationTypeId
  )
  return match?.type === APPLICATION_TYPE_RENEWAL
}

const renderSelectPlaceholder = (params) =>
  params.value || <BCTypography variant="body4">Select</BCTypography>

const renderTextPlaceholder = (params) =>
  params.value || <BCTypography variant="body4">Enter value</BCTypography>

const renderNumberPlaceholder = (params) =>
  params.value !== null && params.value !== undefined && params.value !== '' ? (
    params.value
  ) : (
    <BCTypography variant="body4">Enter number</BCTypography>
  )

const cellErrorStyle = (params) => {
  const rowErrors = params.context?.errors?.[params.data?.id]
  if (rowErrors?.includes(params.colDef.field)) {
    return { borderColor: 'red' }
  }
  return { borderColor: 'unset' }
}

/**
 * Apply the locked fields auto-populated from the selected fuel code on
 * a Renewal row. The fuel code carries the canonical fuel type, feedstock,
 * and feedstock region — the spec says these should be locked on
 * Renewal so the applicant cannot diverge from the source pathway.
 */
const applyFuelCodeAutofill = (rowData, fuelCode) => {
  if (!fuelCode) return rowData
  return {
    ...rowData,
    fuelCodeId: fuelCode.fuelCodeId,
    fuelTypeId: fuelCode.fuelTypeId ?? rowData.fuelTypeId,
    feedstock: fuelCode.feedstock ?? rowData.feedstock,
    feedstockRegion: fuelCode.feedstockLocation ?? rowData.feedstockRegion,
    proposedCi:
      fuelCode.carbonIntensity != null
        ? Number(fuelCode.carbonIntensity)
        : rowData.proposedCi
  }
}

export const buildPathwayColDefs = ({ optionsData, canEdit }) => {
  const applicationTypes = optionsData?.pathwayApplicationTypes || []
  const fuelCodeTypes = optionsData?.pathwayFuelCodeTypes || []
  const fuelTypes = optionsData?.fuelTypes || []
  const transportModes = optionsData?.transportModes || []
  const fuelCodes = optionsData?.fuelCodes || []

  const fuelCodeById = new Map(fuelCodes.map((fc) => [fc.fuelCodeId, fc]))

  const isRenewal = (params) => isRenewalRow(params.data, applicationTypes)
  const lockedOnRenewal = (params) => canEdit && !isRenewal(params)

  return [
    {
      colId: 'action',
      headerName: i18n.t('carbonIntensity:step2.action'),
      cellRenderer: ActionsRenderer,
      cellRendererParams: (params) => ({
        enableDuplicate: canEdit && !isRenewal(params),
        enableDelete: canEdit
      }),
      pinned: 'left',
      maxWidth: 120,
      minWidth: 120,
      editable: false,
      suppressKeyboardEvent,
      filter: false
    },
    { field: 'id', hide: true },
    { field: 'pathwayId', hide: true },
    {
      field: 'applicationTypeId',
      headerName: i18n.t('carbonIntensity:step2.applicationType'),
      headerComponent: canEdit ? RequiredHeader : undefined,
      editable: canEdit,
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: applicationTypes.map((t) => t.type),
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      },
      suppressKeyboardEvent,
      cellRenderer: renderSelectPlaceholder,
      valueGetter: (params) =>
        applicationTypes.find(
          (t) => t.pathwayApplicationTypeId === params.data?.applicationTypeId
        )?.type ?? '',
      valueSetter: (params) => {
        const match = applicationTypes.find((t) => t.type === params.newValue)
        if (!match) return false
        params.data.applicationTypeId = match.pathwayApplicationTypeId
        // Switching back to "New" must clear any renewal-specific fuel code
        // reference; otherwise validation will reject the row server-side.
        if (match.type !== APPLICATION_TYPE_RENEWAL) {
          params.data.fuelCodeId = null
        }
        return true
      },
      minWidth: 160
    },
    {
      field: 'fuelCodeTypeId',
      headerName: i18n.t('carbonIntensity:step2.proposedFuelCodeType'),
      headerComponent: canEdit ? RequiredHeader : undefined,
      editable: canEdit,
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: fuelCodeTypes.map((t) => t.type),
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      },
      suppressKeyboardEvent,
      cellRenderer: renderSelectPlaceholder,
      valueGetter: (params) =>
        fuelCodeTypes.find(
          (t) => t.pathwayFuelCodeTypeId === params.data?.fuelCodeTypeId
        )?.type ?? '',
      valueSetter: (params) => {
        const match = fuelCodeTypes.find((t) => t.type === params.newValue)
        if (!match) return false
        params.data.fuelCodeTypeId = match.pathwayFuelCodeTypeId
        return true
      },
      minWidth: 225
    },
    {
      field: 'operatingDataFrom',
      headerName: i18n.t('carbonIntensity:step2.operatingDataFrom'),
      headerComponent: canEdit ? RequiredHeader : undefined,
      editable: canEdit,
      cellEditor: DateEditor,
      suppressKeyboardEvent,
      cellRenderer: (params) => (
        <BCTypography variant="body4">
          {params.value || 'YYYY-MM-DD'}
        </BCTypography>
      ),
      minWidth: 250
    },
    {
      field: 'operatingDataTo',
      headerName: i18n.t('carbonIntensity:step2.operatingDataTo'),
      headerComponent: canEdit ? RequiredHeader : undefined,
      editable: canEdit,
      cellEditor: DateEditor,
      suppressKeyboardEvent,
      cellRenderer: (params) => (
        <BCTypography variant="body4">
          {params.value || 'YYYY-MM-DD'}
        </BCTypography>
      ),
      minWidth: 230
    },
    {
      field: 'fuelCodeId',
      headerName: i18n.t('carbonIntensity:step2.fuelCodeIteration'),
      // Only enabled (and required) for Renewal rows. The wireframe shows
      // this column greyed out for "New" rows.
      editable: (params) => canEdit && isRenewal(params),
      headerComponent: canEdit ? RequiredHeader : undefined,
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: fuelCodes.map((fc) => fc.fuelCode),
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      },
      suppressKeyboardEvent,
      // When the applicant's organization owns no renewable iterations the
      // editor dropdown is empty; a browser tooltip on the cell explains why
      // (BCGridEditor sets enableBrowserTooltips).
      tooltipValueGetter: (params) =>
        isRenewal(params) && fuelCodes.length === 0
          ? i18n.t('carbonIntensity:step2.noEligibleFuelCodes')
          : null,
      cellRenderer: (params) => {
        if (!isRenewal(params)) {
          return <BCTypography variant="body4">—</BCTypography>
        }
        const match = fuelCodes.find(
          (fc) => fc.fuelCodeId === params.data?.fuelCodeId
        )
        if (match) {
          return match.fuelCode
        }
        return (
          <BCTypography variant="body4">
            {fuelCodes.length === 0 ? 'No eligible iterations' : 'Select'}
          </BCTypography>
        )
      },
      cellStyle: (params) => {
        const base = cellErrorStyle(params)
        if (!isRenewal(params)) {
          return { ...base, backgroundColor: '#f5f5f5' }
        }
        return base
      },
      valueGetter: (params) => {
        const match = fuelCodes.find(
          (fc) => fc.fuelCodeId === params.data?.fuelCodeId
        )
        return match?.fuelCode ?? ''
      },
      valueSetter: (params) => {
        if (!params.newValue) {
          params.data.fuelCodeId = null
          return true
        }
        const match = fuelCodes.find((fc) => fc.fuelCode === params.newValue)
        if (!match) return false
        Object.assign(params.data, applyFuelCodeAutofill(params.data, match))
        return true
      },
      minWidth: 200
    },
    {
      field: 'proposedCi',
      headerName: i18n.t('carbonIntensity:step2.proposedCi'),
      headerComponent: canEdit ? RequiredHeader : undefined,
      // Proposed CI must stay editable for both New and Renewal applications
      // (ticket #4532) — it is never carried over from the existing fuel code.
      editable: canEdit,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 2, showStepperButtons: false },
      type: 'numericColumn',
      cellRenderer: renderNumberPlaceholder,
      cellStyle: cellErrorStyle,
      minWidth: 195
    },
    {
      field: 'fuelTypeId',
      headerName: i18n.t('carbonIntensity:step2.fuelType'),
      headerComponent: canEdit ? RequiredHeader : undefined,
      editable: lockedOnRenewal,
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: fuelTypes.map((ft) => ft.fuelType),
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      },
      suppressKeyboardEvent,
      cellRenderer: renderSelectPlaceholder,
      cellStyle: (params) => {
        const base = cellErrorStyle(params)
        if (isRenewal(params)) return { ...base, backgroundColor: '#f5f5f5' }
        return base
      },
      valueGetter: (params) =>
        fuelTypes.find((t) => t.fuelTypeId === params.data?.fuelTypeId)
          ?.fuelType ?? '',
      valueSetter: (params) => {
        const match = fuelTypes.find((t) => t.fuelType === params.newValue)
        if (!match) return false
        params.data.fuelTypeId = match.fuelTypeId
        return true
      },
      minWidth: 220
    },
    {
      field: 'feedstock',
      headerName: i18n.t('carbonIntensity:step2.feedstock'),
      headerComponent: canEdit ? RequiredHeader : undefined,
      editable: lockedOnRenewal,
      cellEditor: 'agTextCellEditor',
      cellRenderer: renderTextPlaceholder,
      minWidth: 220
    },
    {
      field: 'feedstockRegion',
      headerName: i18n.t('carbonIntensity:step2.feedstockRegion'),
      headerComponent: canEdit ? RequiredHeader : undefined,
      editable: lockedOnRenewal,
      cellEditor: 'agTextCellEditor',
      cellRenderer: renderTextPlaceholder,
      minWidth: 220
    },
    {
      field: 'feedstockTransportMode',
      headerName: i18n.t('carbonIntensity:step2.feedstockTransportMode'),
      headerComponent: canEdit ? RequiredHeader : undefined,
      editable: canEdit,
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: transportModes,
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      },
      suppressKeyboardEvent,
      cellRenderer: renderSelectPlaceholder,
      minWidth: 240
    },
    {
      field: 'feedstockTransportDistance',
      headerName: i18n.t('carbonIntensity:step2.feedstockTransportDistance'),
      headerComponent: canEdit ? RequiredHeader : undefined,
      editable: canEdit,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 0, min: 0, showStepperButtons: false },
      type: 'numericColumn',
      cellRenderer: renderNumberPlaceholder,
      minWidth: 275
    },
    {
      field: 'coproducts',
      headerName: i18n.t('carbonIntensity:step2.coproducts'),
      editable: canEdit,
      cellEditor: 'agTextCellEditor',
      cellRenderer: renderTextPlaceholder,
      minWidth: 240
    },
    {
      field: 'finishedFuelTransportMode',
      headerName: i18n.t('carbonIntensity:step2.finishedFuelTransportMode'),
      headerComponent: canEdit ? RequiredHeader : undefined,
      editable: canEdit,
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: transportModes,
        multiple: false,
        disableCloseOnSelect: false,
        freeSolo: false,
        openOnFocus: true
      },
      suppressKeyboardEvent,
      cellRenderer: renderSelectPlaceholder,
      minWidth: 260
    },
    {
      field: 'finishedFuelTransportDistance',
      headerName: i18n.t('carbonIntensity:step2.finishedFuelTransportDistance'),
      headerComponent: canEdit ? RequiredHeader : undefined,
      editable: canEdit,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 0, min: 0, showStepperButtons: false },
      type: 'numericColumn',
      cellRenderer: renderNumberPlaceholder,
      minWidth: 300
    }
  ].map((colDef) => ({
    cellStyle: cellErrorStyle,
    ...colDef
  }))
}

const formatSummaryDate = (value) => {
  if (!value) return ''
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    return d.toISOString().slice(0, 10)
  } catch {
    return String(value)
  }
}

export const ciApplicationPathwaySummaryColDefs = ({
  optionsData,
  proposedFuelCodeEffectiveDate
}) => {
  const applicationTypes = optionsData?.pathwayApplicationTypes || []
  const fuelCodeTypes = optionsData?.pathwayFuelCodeTypes || []
  const fuelTypes = optionsData?.fuelTypes || []

  const applicationTypeLabel = (data) =>
    data?.applicationType?.type ||
    applicationTypes.find(
      (t) => t.pathwayApplicationTypeId === data?.applicationTypeId
    )?.type ||
    ''

  const fuelCodeTypeLabel = (data) =>
    data?.fuelCodeType?.type ||
    fuelCodeTypes.find((t) => t.pathwayFuelCodeTypeId === data?.fuelCodeTypeId)
      ?.type ||
    ''

  const fuelCodeLabel = (data) => data?.fuelCode?.fuelCode || ''

  const fuelTypeLabel = (data) =>
    data?.fuelType?.fuelType ||
    fuelTypes.find((t) => t.fuelTypeId === data?.fuelTypeId)?.fuelType ||
    ''

  return [
    {
      field: 'applicationTypeId',
      headerName: i18n.t('carbonIntensity:step2.applicationType'),
      valueGetter: ({ data }) => applicationTypeLabel(data),
      minWidth: 160
    },
    {
      field: 'fuelCodeTypeId',
      headerName: i18n.t('carbonIntensity:step2.proposedFuelCodeType'),
      valueGetter: ({ data }) => fuelCodeTypeLabel(data),
      minWidth: 220
    },
    {
      field: 'operatingDataFrom',
      headerName: i18n.t('carbonIntensity:step2.operatingDataFrom'),
      valueGetter: ({ data }) =>
        formatSummaryDate(
          data?.operatingDataFrom ||
            data?.operating_data_from ||
            proposedFuelCodeEffectiveDate
        ),
      minWidth: 200
    },
    {
      field: 'operatingDataTo',
      headerName: i18n.t('carbonIntensity:step2.operatingDataTo'),
      valueGetter: ({ data }) =>
        formatSummaryDate(data?.operatingDataTo || data?.operating_data_to),
      minWidth: 200
    },
    {
      field: 'fuelCodeId',
      headerName: i18n.t('carbonIntensity:step2.fuelCodeIteration'),
      valueGetter: ({ data }) => fuelCodeLabel(data) || '—',
      minWidth: 200
    },
    {
      field: 'proposedCi',
      headerName: i18n.t('carbonIntensity:step2.proposedCi'),
      minWidth: 180
    },
    {
      field: 'fuelTypeId',
      headerName: i18n.t('carbonIntensity:step2.fuelType'),
      valueGetter: ({ data }) => fuelTypeLabel(data),
      minWidth: 220
    },
    {
      field: 'feedstock',
      headerName: i18n.t('carbonIntensity:step2.feedstock'),
      minWidth: 220
    },
    {
      field: 'feedstockRegion',
      headerName: i18n.t('carbonIntensity:step2.feedstockRegion'),
      minWidth: 220
    },
    {
      field: 'feedstockTransportMode',
      headerName: i18n.t('carbonIntensity:step2.feedstockTransportMode'),
      minWidth: 240
    },
    {
      field: 'feedstockTransportDistance',
      headerName: i18n.t('carbonIntensity:step2.feedstockTransportDistance'),
      minWidth: 240
    },
    {
      field: 'coproducts',
      headerName: i18n.t('carbonIntensity:step2.coproducts'),
      minWidth: 240
    },
    {
      field: 'finishedFuelTransportMode',
      headerName: i18n.t('carbonIntensity:step2.finishedFuelTransportMode'),
      minWidth: 260
    },
    {
      field: 'finishedFuelTransportDistance',
      headerName: i18n.t('carbonIntensity:step2.finishedFuelTransportDistance'),
      minWidth: 260
    }
  ]
}

export const ciApplicationPathwayChangelogColDefs = ({
  optionsData,
  proposedFuelCodeEffectiveDate
}) => [
  {
    field: 'actionType',
    headerName: i18n.t('carbonIntensity:summary.changeAction'),
    minWidth: 140,
    valueGetter: ({ data }) => {
      if (data?.actionType === 'UPDATE') {
        return data?.updated ? 'Edited old' : 'Edited new'
      }
      if (data?.actionType === 'DELETE') return 'Deleted'
      if (data?.actionType === 'CREATE') return 'Added'
      return data?.actionType || ''
    },
    cellStyle: (params) => {
      if (params.data?.actionType === 'UPDATE') {
        return { backgroundColor: colors.alerts.warning.background }
      }
    }
  },
  ...ciApplicationPathwaySummaryColDefs({
    optionsData,
    proposedFuelCodeEffectiveDate
  }).map((colDef) => ({
    ...colDef,
    cellStyle: (params) => changelogCellStyle(params, colDef.field)
  }))
]

export const defaultColDef = {
  editable: false,
  resizable: true,
  filter: false,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true
}

/**
 * Validate a single row client-side. Returns a list of bad field names;
 * empty list means the row is OK.
 */
export const validatePathwayRow = (row, applicationTypes) => {
  const errors = []
  if (!row.applicationTypeId) errors.push('applicationTypeId')
  if (!row.fuelCodeTypeId) errors.push('fuelCodeTypeId')
  if (!row.operatingDataFrom) errors.push('operatingDataFrom')
  if (!row.operatingDataTo) errors.push('operatingDataTo')
  if (
    row.operatingDataFrom &&
    row.operatingDataTo &&
    row.operatingDataTo < row.operatingDataFrom
  ) {
    errors.push('operatingDataTo')
  }
  if (
    row.proposedCi === null ||
    row.proposedCi === undefined ||
    row.proposedCi === '' ||
    Number.isNaN(Number(row.proposedCi))
  ) {
    errors.push('proposedCi')
  }
  if (!row.fuelTypeId) errors.push('fuelTypeId')
  if (!row.feedstock?.toString().trim()) errors.push('feedstock')
  if (!row.feedstockRegion?.toString().trim()) errors.push('feedstockRegion')
  if (!row.feedstockTransportMode) errors.push('feedstockTransportMode')
  if (
    row.feedstockTransportDistance === null ||
    row.feedstockTransportDistance === undefined ||
    row.feedstockTransportDistance === ''
  ) {
    errors.push('feedstockTransportDistance')
  }
  if (!row.finishedFuelTransportMode) errors.push('finishedFuelTransportMode')
  if (
    row.finishedFuelTransportDistance === null ||
    row.finishedFuelTransportDistance === undefined ||
    row.finishedFuelTransportDistance === ''
  ) {
    errors.push('finishedFuelTransportDistance')
  }

  if (isRenewalRow(row, applicationTypes) && !row.fuelCodeId) {
    errors.push('fuelCodeId')
  }
  return errors
}

const FIELD_LABEL_KEYS = {
  applicationTypeId: 'carbonIntensity:step2.applicationType',
  fuelCodeTypeId: 'carbonIntensity:step2.proposedFuelCodeType',
  operatingDataFrom: 'carbonIntensity:step2.operatingDataFrom',
  operatingDataTo: 'carbonIntensity:step2.operatingDataTo',
  fuelCodeId: 'carbonIntensity:step2.fuelCodeIteration',
  proposedCi: 'carbonIntensity:step2.proposedCi',
  fuelTypeId: 'carbonIntensity:step2.fuelType',
  feedstock: 'carbonIntensity:step2.feedstock',
  feedstockRegion: 'carbonIntensity:step2.feedstockRegion',
  feedstockTransportMode: 'carbonIntensity:step2.feedstockTransportMode',
  feedstockTransportDistance:
    'carbonIntensity:step2.feedstockTransportDistance',
  finishedFuelTransportMode: 'carbonIntensity:step2.finishedFuelTransportMode',
  finishedFuelTransportDistance:
    'carbonIntensity:step2.finishedFuelTransportDistance'
}

export const fieldLabels = (fields, t) =>
  fields
    .map((field) =>
      FIELD_LABEL_KEYS[field] ? t(FIELD_LABEL_KEYS[field]) : field
    )
    .filter(Boolean)

export const rowToApiPayload = (row) => ({
  pathwayId: row.pathwayId ?? null,
  applicationTypeId: Number(row.applicationTypeId),
  fuelCodeTypeId: Number(row.fuelCodeTypeId),
  operatingDataFrom: row.operatingDataFrom,
  operatingDataTo: row.operatingDataTo,
  fuelCodeId: row.fuelCodeId ? Number(row.fuelCodeId) : null,
  proposedCi: Number(row.proposedCi),
  fuelTypeId: Number(row.fuelTypeId),
  feedstock: row.feedstock?.toString().trim() ?? '',
  feedstockRegion: row.feedstockRegion?.toString().trim() ?? '',
  feedstockTransportMode: row.feedstockTransportMode,
  feedstockTransportDistance: Number(row.feedstockTransportDistance),
  coproducts: row.coproducts?.toString().trim() || null,
  finishedFuelTransportMode: row.finishedFuelTransportMode,
  finishedFuelTransportDistance: Number(row.finishedFuelTransportDistance)
})

export const apiToRow = (pathway) => ({
  id: `pathway-${pathway.pathwayId}`,
  pathwayId: pathway.pathwayId,
  applicationTypeId: pathway.applicationTypeId,
  fuelCodeTypeId: pathway.fuelCodeTypeId,
  operatingDataFrom: pathway.operatingDataFrom,
  operatingDataTo: pathway.operatingDataTo,
  fuelCodeId: pathway.fuelCodeId,
  proposedCi: pathway.proposedCi != null ? Number(pathway.proposedCi) : null,
  fuelTypeId: pathway.fuelTypeId,
  feedstock: pathway.feedstock,
  feedstockRegion: pathway.feedstockRegion,
  feedstockTransportMode: pathway.feedstockTransportMode,
  feedstockTransportDistance: pathway.feedstockTransportDistance,
  coproducts: pathway.coproducts,
  finishedFuelTransportMode: pathway.finishedFuelTransportMode,
  finishedFuelTransportDistance: pathway.finishedFuelTransportDistance
})
