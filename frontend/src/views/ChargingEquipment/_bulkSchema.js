import { 
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
  errors = {},
  warnings = {},
  actionsOptions = null,
  allowAllocatingOrg = true,
  showActions = true
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
    field: 'charging_site_id',
    headerComponent: RequiredHeader,
    headerName: i18n.t('chargingEquipment:chargingSite'),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: {
      options: chargingSites.map(site => ({
        value: site.charging_site_id,
        label: site.site_name
      })),
      openOnFocus: true
    },
    valueGetter: (params) => params.data.charging_site_id,
    valueSetter: (params) => {
      const incoming = params.newValue
      const raw = incoming && typeof incoming === 'object' ? incoming.value : incoming
      const next = raw === '' || raw == null ? '' : Number(raw)
      params.data.charging_site_id = next
      params.newValue = next
      return true
    },
    editable: (params) =>
      isEditableByStatus(params) &&
      (!params.data?.charging_equipment_id || params.data?.status === 'Draft'),
    valueFormatter: (params) => {
      const site = chargingSites.find(s => s.charging_site_id === params.value)
      return site ? site.site_name : ''
    },
    cellStyle: (params) => StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 200,
    editable: (params) =>
      isEditableByStatus(params) &&
      (!params.data?.charging_equipment_id || params.data?.status === 'Draft')
  },
  {
    field: 'allocating_organization_id',
    headerName: i18n.t('chargingEquipment:allocatingOrganization'),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: {
      options: organizations.map(org => ({
        value: org.organization_id,
        label: org.legal_name || org.name
      })),
      openOnFocus: true,
      allowEmpty: true
    },
    valueGetter: (params) => params.data.allocating_organization_id,
    valueSetter: (params) => {
      const incoming = params.newValue
      const raw = incoming && typeof incoming === 'object' ? incoming.value : incoming
      const next = raw === '' || raw == null ? '' : Number(raw)
      params.data.allocating_organization_id = next
      params.newValue = next
      return true
    },
    editable: () => Boolean(allowAllocatingOrg),
    valueFormatter: (params) => {
      const org = organizations.find(o => o.organization_id === params.value)
      return org ? (org.legal_name || org.name) : ''
    },
    minWidth: 200,
    editable: () => Boolean(allowAllocatingOrg)
  },
  {
    field: 'serial_number',
    headerComponent: RequiredHeader,
    headerName: i18n.t('chargingEquipment:serialNumber'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 150,
    editable: isEditableByStatus
  },
  {
    field: 'manufacturer',
    headerComponent: RequiredHeader,
    headerName: i18n.t('chargingEquipment:manufacturer'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 150,
    editable: isEditableByStatus
  },
  {
    field: 'model',
    headerName: i18n.t('chargingEquipment:model'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    minWidth: 120,
    editable: isEditableByStatus
  },
  {
    field: 'level_of_equipment_id',
    headerComponent: RequiredHeader,
    headerName: i18n.t('chargingEquipment:levelOfEquipment'),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: {
      options: levels.map(level => ({
        value: level.level_of_equipment_id,
        label: level.name
      })),
      openOnFocus: true
    },
    valueGetter: (params) => params.data.level_of_equipment_id,
    valueSetter: (params) => {
      const incoming = params.newValue
      const raw = incoming && typeof incoming === 'object' ? incoming.value : incoming
      const next = raw === '' || raw == null ? '' : Number(raw)
      params.data.level_of_equipment_id = next
      params.newValue = next
      return true
    },
    editable: isEditableByStatus,
    valueFormatter: (params) => {
      const level = levels.find(l => l.level_of_equipment_id === params.value)
      return level ? level.name : ''
    },
    cellStyle: (params) => StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 180,
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
      const raw = incoming && typeof incoming === 'object' ? incoming.value : incoming
      const next = raw ?? ''
      params.data.ports = next
      params.newValue = next
      return true
    },
    minWidth: 120,
    editable: isEditableByStatus
  },
  {
    field: 'intended_use_ids',
    headerName: i18n.t('chargingEquipment:intendedUses'),
    cellEditor: AutocompleteCellEditor,
    cellEditorParams: {
      options: endUseTypes.map(type => ({
        value: type.end_use_type_id,
        label: type.type
      })),
      multiple: true,
      disableCloseOnSelect: true,
      openOnFocus: true
    },
    cellRenderer: MultiSelectRenderer,
    valueGetter: (params) => params.data.intended_use_ids,
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
      params.data.intended_use_ids = raw
      params.newValue = raw
      return true
    },
    valueFormatter: (params) => {
      if (!params.value || !Array.isArray(params.value)) return ''
      const selectedTypes = endUseTypes.filter(type => 
        params.value.includes(type.end_use_type_id)
      )
      return selectedTypes.map(type => type.type).join(', ')
    },
    minWidth: 200,
    editable: isEditableByStatus
  },
  {
    field: 'notes',
    headerName: i18n.t('chargingEquipment:notes'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    minWidth: 200,
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