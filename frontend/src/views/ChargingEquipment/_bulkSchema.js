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

export const bulkChargingEquipmentColDefs = (
  chargingSites = [],
  organizations = [],
  levels = [],
  endUseTypes = [],
  errors = {},
  warnings = {}
) => [
  validation,
  actions((params) => ({
    enableDuplicate: false,
    enableDelete: true,
    enableUndo: false,
    enableStatus: false
  })),
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
    valueFormatter: (params) => {
      const site = chargingSites.find(s => s.charging_site_id === params.value)
      return site ? site.site_name : ''
    },
    cellStyle: (params) => StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 200,
    editable: true
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
    valueFormatter: (params) => {
      const org = organizations.find(o => o.organization_id === params.value)
      return org ? (org.legal_name || org.name) : ''
    },
    minWidth: 200,
    editable: true
  },
  {
    field: 'serial_number',
    headerComponent: RequiredHeader,
    headerName: i18n.t('chargingEquipment:serialNumber'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 150,
    editable: true
  },
  {
    field: 'manufacturer',
    headerComponent: RequiredHeader,
    headerName: i18n.t('chargingEquipment:manufacturer'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    cellStyle: (params) => StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 150,
    editable: true
  },
  {
    field: 'model',
    headerName: i18n.t('chargingEquipment:model'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    minWidth: 120,
    editable: true
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
    valueFormatter: (params) => {
      const level = levels.find(l => l.level_of_equipment_id === params.value)
      return level ? level.name : ''
    },
    cellStyle: (params) => StandardCellWarningAndErrors(params, errors, warnings),
    minWidth: 180,
    editable: true
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
    minWidth: 120,
    editable: true
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
    valueFormatter: (params) => {
      if (!params.value || !Array.isArray(params.value)) return ''
      const selectedTypes = endUseTypes.filter(type => 
        params.value.includes(type.end_use_type_id)
      )
      return selectedTypes.map(type => type.type).join(', ')
    },
    minWidth: 200,
    editable: true
  },
  {
    field: 'notes',
    headerName: i18n.t('chargingEquipment:notes'),
    cellEditor: 'agTextCellEditor',
    cellDataType: 'text',
    minWidth: 200,
    editable: true
  }
]

export const defaultBulkColDef = {
  editable: true,
  resizable: true,
  filter: false,
  floatingFilter: false,
  sortable: false,
  singleClickEdit: true
}