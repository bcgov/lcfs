// import { getOrganization } from '@/utils/getOrganization'
// import { getStatus } from '@/utils/getStatus'
// import dayjs from 'dayjs'

// export const gridProps = {
//   columnDefs: [
//     { field: 'transactionId', headerName: 'ID' },
//     {
//       field: 'compliancePeriod',
//       headerName: 'Compliant period'
//     },
//     { field: 'transactionType.type', headerName: 'Type' },
//     {
//       valueGetter: (data) => getOrganization(data, 'from'),
//       headerName: 'Compliance units from'
//     },
//     {
//       valueGetter: (data) => getOrganization(data, 'to'),
//       headerName: 'Compliance units to'
//     },
//     { field: 'complianceUnits', headerName: 'Number of units' },
//     { field: 'valuePerUnit', headerName: 'Value per unit' },
//     {
//       valueGetter: getStatus,
//       headerName: 'Status'
//     },
//     {
//       valueFormatter: (data) => dayjs(data.lastUpdated).format('YYYY-MM-DD'),
//       headerName: 'Last updated'
//     }
//   ],
//   defaultColDef: {
//     resizable: true,
//     sortable: true,
//     filter: true,
//     floatingFilter: true
//   }
// }
