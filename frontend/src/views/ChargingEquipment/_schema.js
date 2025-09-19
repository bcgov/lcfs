import { createStatusRenderer } from '@/utils/grid/cellRenderers'

export const defaultSortModel = [{ field: 'updated_date', direction: 'desc' }]

export const chargingEquipmentColDefs = [
  // First column: dedicated checkbox selection column pinned left
  {
    headerName: '',
    field: '__select__',
    width: 52,
    minWidth: 52,
    maxWidth: 60,
    pinned: 'left',
    lockPinned: true,
    filter: false,
    sortable: false,
    suppressHeaderMenuButton: true,
    checkboxSelection: (params) => {
      const status = params.data?.status
      // allow selecting Draft/Updated/Validated; disallow Submitted/Decommissioned for submit
      return status !== 'Decommissioned'
    },
    headerCheckboxSelection: true,
    headerCheckboxSelectionFilteredOnly: true,
    suppressSizeToFit: true
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 150,
    cellRenderer: createStatusRenderer(
      {
        Draft: 'info',
        Updated: 'info',
        Submitted: 'warning',
        Validated: 'success',
        Decommissioned: 'smoky'
      },
      { statusField: 'status', replaceUnderscores: false }
    ),
    filter: 'agSetColumnFilter',
    filterParams: {
      values: ['Draft', 'Updated', 'Submitted', 'Validated', 'Decommissioned']
    }
  },
  {
    field: 'site_name',
    headerName: 'Site Name',
    flex: 1,
    minWidth: 200
  },
  {
    field: 'registration_number',
    headerName: 'Registration #',
    width: 150
  },
  {
    field: 'version',
    headerName: 'Version',
    width: 90,
    type: 'numericColumn'
  },
  {
    field: 'allocating_organization_name',
    headerName: 'Allocating Organization',
    flex: 1,
    minWidth: 200
  },
  {
    field: 'serial_number',
    headerName: 'Serial #',
    width: 150
  },
  {
    field: 'manufacturer',
    headerName: 'Manufacturer',
    width: 150
  },
  {
    field: 'model',
    headerName: 'Model',
    width: 150
  },
  {
    field: 'level_of_equipment_name',
    headerName: 'Level of Equipment',
    width: 180
  },
  {
    field: 'created_date',
    headerName: 'Created',
    width: 120,
    type: 'dateColumn',
    valueFormatter: (params) => {
      if (!params.value) return ''
      return new Date(params.value).toLocaleDateString()
    }
  },
  {
    field: 'updated_date',
    headerName: 'Last Updated',
    width: 120,
    type: 'dateColumn',
    valueFormatter: (params) => {
      if (!params.value) return ''
      return new Date(params.value).toLocaleDateString()
    }
  }
]

export const statusOptions = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Updated', label: 'Updated' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Validated', label: 'Validated' },
  { value: 'Decommissioned', label: 'Decommissioned' }
]