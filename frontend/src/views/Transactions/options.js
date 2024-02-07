import { getStatus } from '@/utils/getStatus'
import { getOrganization } from '@/utils/getOrganization'
import * as dayjs from 'dayjs'

export const gridProps = {
  columnDefs: [
    { field: 'transaction_id', headerName: 'ID' },
    {
      field: 'compliance_period',
      headerName: 'Compliant period'
    },
    { field: 'transaction_type.type', headerName: 'Type' },
    {
      valueGetter: (data) => getOrganization(data, 'from'),
      headerName: 'Compliance units from'
    },
    {
      valueGetter: (data) => getOrganization(data, 'to'),
      headerName: 'Compliance units to'
    },
    { field: 'compliance_units', headerName: 'Number of units' },
    { field: 'value_per_unit', headerName: 'Value per unit' },
    {
      valueGetter: getStatus,
      headerName: 'Status'
    },
    {
      valueFormatter: (data) => dayjs(data.last_updated).format('YYYY-MM-DD'),
      headerName: 'Last updated'
    }
  ],
  defaultColDef: {
    resizable: true,
    sortable: true,
    filter: true,
    floatingFilter: true
  }
}
