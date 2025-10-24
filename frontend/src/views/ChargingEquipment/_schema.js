import { createStatusRenderer } from '@/utils/grid/cellRenderers'

export const defaultSortModel = [{ field: 'updated_date', direction: 'desc' }]

export const chargingEquipmentColDefs = (isIDIR = false) => {
  const cols = [
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
        return status !== 'Decommissioned' && status !== 'Submitted'
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
    }
  ]

  // Add Organization column only for IDIR users (after Site Name)
  if (isIDIR) {
    cols.push({
      field: 'organization_name',
      headerName: 'Organization',
      flex: 1,
      minWidth: 200
    })
  }

  // Add remaining columns
  cols.push(
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
      field: 'intended_uses',
      headerName: 'Intended Uses',
      width: 200,
      valueFormatter: (params) => {
        if (!params.value || !Array.isArray(params.value)) return ''
        return params.value.map(use => use.type).join(', ')
      }
    },
    {
      field: 'intended_users',
      headerName: 'Intended Users',
      width: 200,
      valueFormatter: (params) => {
        if (!params.value || !Array.isArray(params.value)) return ''
        return params.value.map(user => user.type_name).join(', ')
      }
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
  )

  return cols
}

export const statusOptions = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Updated', label: 'Updated' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Validated', label: 'Validated' },
  { value: 'Decommissioned', label: 'Decommissioned' }
]
