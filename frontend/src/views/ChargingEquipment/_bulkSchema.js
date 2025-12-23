import {
  AsyncSuggestionEditor,
  AutocompleteCellEditor,
  RequiredHeader,
  TextCellEditor
} from '@/components/BCDataGrid/components'
import { actions, validation } from '@/components/BCDataGrid/columns'
import {
  CommonArrayRenderer,
  MultiSelectRenderer
} from '@/utils/grid/cellRenderers'
import { StandardCellWarningAndErrors } from '@/utils/grid/errorRenderers'
import i18n from '@/i18n'
import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { apiRoutes } from '@/constants/routes'

const isEditableByStatus = (params) => {
  const status = params?.data?.status
  if (!status) return true
  return ['Draft', 'Updated', 'Validated'].includes(status)
}

export const bulkChargingEquipmentColDefs = (
  chargingSites = [],
  organizations = [],
  levels = [],
  endUseTypes = [],
  endUserTypes = [],
  errors = {},
  warnings = {},
  actionsOptions = null,
  allowAllocatingOrg = true,
  showActions = true,
  isChargingSiteLocked = false
) => {
  const cols = [validation]
  if (showActions) {
    cols.push(
      actions((params) => ({
        enableDuplicate: false,
        enableDelete: true,
        enableUndo: false,
        enableStatus: false,
        ...(actionsOptions || {})
      }))
    )
  }
  return [
    ...cols,
    {
      field: 'id',
      hide: true
    },
    {
      field: 'chargingSiteId',
      headerComponent: RequiredHeader,
      headerName: i18n.t('chargingEquipment:chargingSite'),
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: chargingSites.map((site) => ({
          value: site.chargingSiteId,
          label: site.siteName
        })),
        openOnFocus: true
      },
      valueGetter: (params) => params.data.chargingSiteId,
      valueSetter: (params) => {
        const incoming = params.newValue
        const raw =
          incoming && typeof incoming === 'object' ? incoming.value : incoming
        const next = raw === '' || raw == null ? '' : Number(raw)
        params.data.chargingSiteId = next
        const site = chargingSites.find((s) => s.chargingSiteId === next)
        if (site) {
          params.data.latitude = site.latitude
          params.data.longitude = site.longitude
        }
        params.newValue = next
        return true
      },
      editable: (params) =>
        !isChargingSiteLocked &&
        isEditableByStatus(params) &&
        (!params.data?.chargingEquipmentId || params.data?.status === 'Draft'),
      valueFormatter: (params) => {
        const site = chargingSites.find(
          (s) => s.chargingSiteId === params.value
        )
        return site ? site.siteName : ''
      },
      cellStyle: (params) => {
        const baseStyle = StandardCellWarningAndErrors(params, errors, warnings)
        if (isChargingSiteLocked) {
          return {
            ...baseStyle,
            backgroundColor: '#f5f5f5',
            cursor: 'not-allowed'
          }
        }
        return baseStyle
      },
      minWidth: 310
    },
    {
      field: 'serialNumber',
      headerComponent: RequiredHeader,
      headerName: i18n.t('chargingEquipment:serialNumber'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      minWidth: 220,
      editable: isEditableByStatus
    },
    {
      field: 'manufacturer',
      headerComponent: RequiredHeader,
      headerName: i18n.t('chargingEquipment:manufacturer'),
      minWidth: 320,
      cellEditor: AsyncSuggestionEditor,
      cellEditorParams: (params) => ({
        queryKey: 'fuel-code-search',
        queryFn: async ({ client, queryKey }) => {
          try {
            const [, searchTerm] = queryKey
            const path = `${
              apiRoutes.searchFinalSupplyEquipments
            }manufacturer=${encodeURIComponent(searchTerm)}`
            const response = await client.get(path)
            return response.data
          } catch (error) {
            console.error('Error fetching manufacturer data:', error)
            return []
          }
        },
        optionLabel: 'manufacturer',
        title: 'fuelCode'
      }),
      suppressKeyboardEvent,
      cellDataType: 'text',
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      editable: isEditableByStatus
    },
    {
      field: 'model',
      headerName: i18n.t('chargingEquipment:model'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      minWidth: 220,
      editable: isEditableByStatus,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings)
    },
    {
      field: 'levelOfEquipmentId',
      headerComponent: RequiredHeader,
      headerName: i18n.t('chargingEquipment:levelOfEquipment'),
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: levels.map((level) => ({
          value: level.levelOfEquipmentId,
          label: level.name
        })),
        openOnFocus: true
      },
      valueGetter: (params) => params.data.levelOfEquipmentId,
      valueSetter: (params) => {
        const incoming = params.newValue
        const raw =
          incoming && typeof incoming === 'object' ? incoming.value : incoming
        const next = raw === '' || raw == null ? '' : Number(raw)
        params.data.levelOfEquipmentId = next
        params.newValue = next
        return true
      },
      editable: isEditableByStatus,
      valueFormatter: (params) => {
        const level = levels.find((l) => l.levelOfEquipmentId === params.value)
        return level ? level.name : ''
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      minWidth: 400,
      editable: isEditableByStatus
    },
    {
      field: 'ports',
      headerName: i18n.t('chargingEquipment:ports'),
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: [
          { value: 'Single port', label: 'Single port' },
          { value: 'Dual port', label: 'Dual port' }
        ],
        openOnFocus: true
      },
      valueGetter: (params) => params.data.ports,
      valueSetter: (params) => {
        const incoming = params.newValue
        const raw =
          incoming && typeof incoming === 'object' ? incoming.value : incoming
        const next = raw ?? ''
        params.data.ports = next
        params.newValue = next
        return true
      },
      minWidth: 120,
      editable: isEditableByStatus,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings)
    },
    {
      field: 'intendedUseIds',
      headerComponent: RequiredHeader,
      headerName: i18n.t('chargingEquipment:intendedUses'),
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: endUseTypes.map((type) => ({
          value: type.endUseTypeId,
          label: type.type
        })),
        multiple: true,
        disableCloseOnSelect: true,
        openOnFocus: true
      },
      cellRenderer: MultiSelectRenderer,
      valueGetter: (params) => {
        const value = params.data.intendedUseIds
        return Array.isArray(value) ? value : []
      },
      editable: isEditableByStatus,
      valueSetter: (params) => {
        const incoming = params.newValue
        let raw = []
        if (Array.isArray(incoming)) {
          raw = incoming
            .map((v) => (typeof v === 'object' ? v.value : v))
            .filter((v) => v != null && v !== '')
            .map((v) => Number(v))
        }
        params.data.intendedUseIds = raw
        params.newValue = raw
        return true
      },
      valueFormatter: (params) => {
        if (!params.value || !Array.isArray(params.value)) return ''
        const selectedTypes = endUseTypes.filter((type) =>
          params.value.includes(type.endUseTypeId)
        )
        return selectedTypes.map((type) => type.type).join(', ')
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      minWidth: 200,
      editable: isEditableByStatus
    },
    {
      field: 'intendedUserIds',
      headerComponent: RequiredHeader,
      headerName: i18n.t('chargingEquipment:intendedUsers'),
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: {
        options: endUserTypes.map((type) => ({
          value: type.endUserTypeId,
          label: type.typeName
        })),
        multiple: true,
        disableCloseOnSelect: true,
        openOnFocus: true
      },
      cellRenderer: MultiSelectRenderer,
      valueGetter: (params) => {
        const value = params.data.intendedUserIds
        return Array.isArray(value) ? value : []
      },
      editable: isEditableByStatus,
      valueSetter: (params) => {
        const incoming = params.newValue
        let raw = []
        if (Array.isArray(incoming)) {
          raw = incoming
            .map((v) => (typeof v === 'object' ? v.value : v))
            .filter((v) => v != null && v !== '')
            .map((v) => Number(v))
        }
        params.data.intendedUserIds = raw
        params.newValue = raw
        return true
      },
      valueFormatter: (params) => {
        if (!params.value || !Array.isArray(params.value)) return ''
        const selectedTypes = endUserTypes.filter((type) =>
          params.value.includes(type.endUserTypeId)
        )
        return selectedTypes.map((type) => type.typeName).join(', ')
      },
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      minWidth: 200,
      editable: isEditableByStatus
    },
    {
      field: 'latitude',
      headerComponent: RequiredHeader,
      headerName: i18n.t('chargingEquipment:latitude'),
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        precision: 6,
        max: 90,
        min: -90,
        showStepperButtons: false
      },
      cellDataType: 'number',
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      minWidth: 150,
      editable: isEditableByStatus
    },
    {
      field: 'longitude',
      headerComponent: RequiredHeader,
      headerName: i18n.t('chargingEquipment:longitude'),
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        precision: 6,
        max: 180,
        min: -180,
        showStepperButtons: false
      },
      cellDataType: 'number',
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      minWidth: 150,
      editable: isEditableByStatus
    },
    {
      field: 'notes',
      headerName: i18n.t('chargingEquipment:notes'),
      cellEditor: 'agTextCellEditor',
      cellDataType: 'text',
      minWidth: 400,
      cellStyle: (params) =>
        StandardCellWarningAndErrors(params, errors, warnings),
      editable: isEditableByStatus
    }
  ]
}

export const defaultBulkColDef = {
  editable: true,
  resizable: true,
  filter: false,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true
}
