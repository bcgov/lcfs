import { phoneNumberFormatter } from '@/utils/formatters'
import {
  GovernmentRoleRenderer,
  RoleRenderer,
  StatusRenderer
} from '@/utils/cellRenderers'

export const usersColumnDefs = [
  { colId: 'display_name', field: 'display_name', headerName: 'Name' },
  {
    colId: 'role',
    field: 'role',
    headerName: 'Role(s)',
    // valueFormatter: ({ value }) => value.map(role => role.name).join(', '),
    cellRenderer: RoleRenderer,
    cellClass: 'vertical-middle',
    sortable: false
  },
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

export const usersDefaultColDef = {
  resizable: true,
  sortable: true,
  filter: true,
  floatingFilter: true, // enables the filter boxes under the header label
  suppressMenu: true // suppresses the menu button appearing next to the Header Label
}

export const rolesColumnDefs = [
  { colId: 'name', field: 'name', headerName: 'Role' },
  { colId: 'description', field: 'description', headerName: 'Description' },
  {
    colId: 'is_government_role',
    field: 'is_government_role',
    headerName: 'Role conferred to',
    cellRenderer: GovernmentRoleRenderer,
    cellClass: 'vertical-middle'
  }
]

export const rolesDefaultColDef = {
  resizable: true,
  sortable: true
}
