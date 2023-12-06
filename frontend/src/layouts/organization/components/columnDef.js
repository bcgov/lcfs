import { numberFormatter } from '@/utils/formatters'

export const coloumnDefinition = [
  { field: 'organizationName', headerName: 'Organization' },
  {
    field: 'complianceUnits',
    headerName: 'Compliance Units',
    valueFormatter: numberFormatter
  },
  {
    field: 'reserve',
    headerName: 'In Reserve',
    valueFormatter: numberFormatter
  },
  { field: 'registered', headerName: 'Registered' }
]

export const defaultColumnOptions = {
  resizable: true,
  sortable: true,
  filter: true,
  floatingFilter: true
}
