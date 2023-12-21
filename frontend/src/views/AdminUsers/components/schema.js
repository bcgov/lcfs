import { phoneNumberFormatter } from '@/utils/formatters'
import { StatusRenderer } from '@/utils/cellRenderers'

export const columnDefs = [
  { colId: 'display_name', field: 'display_name', headerName: 'Name' },
  { colId: 'role', field: 'role', headerName: 'Role(s)' },
  { colId: 'email', field: 'email' },
  { colId: 'phone', field: 'phone', valueFormatter: phoneNumberFormatter },
  {
    colId: 'is_active',
    field: 'is_active',
    headerName: 'Status',
    cellRenderer: StatusRenderer,
    cellClass: 'vertical-middle'
  }
]

export const defaultColDef = {
  resizable: true,
  sortable: true,
  filter: true,
  floatingFilter: true, // enables the filter boxes under the header label
  suppressMenu: true // suppresses the menu button appearing next to the Header Label
}
