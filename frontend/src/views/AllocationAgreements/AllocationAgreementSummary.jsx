// import BCBox from '@/components/BCBox'
// import Grid2 from '@mui/material/Grid2'
// import { useMemo, useRef, useState } from 'react'
// import { useTranslation } from 'react-i18next'
// import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
// import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
// import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
// import { defaultInitialPagination } from '@/constants/schedules.js'
// import { allocAgrmtSummaryColDefs } from './_schema'

// export const AllocationAgreementSummary = ({ data, status }) => {
//   const [paginationOptions, setPaginationOptions] = useState(
//     defaultInitialPagination
//   )
//   const gridRef = useRef()
//   const { t } = useTranslation(['common', 'allocationAgreement'])

//   // Client-side pagination logic
//   const paginatedData = useMemo(() => {
//     if (!data?.allocationAgreements) {
//       return {
//         data: {
//           allocationAgreements: [],
//           pagination: {
//             page: 1,
//             size: paginationOptions.size,
//             total: 0
//           }
//         },
//         error: null,
//         isError: false,
//         isLoading: false
//       }
//     }

//     let filteredData = [
//       ...(data.allocationAgreements.filter(
//         (item) => item.actionType !== 'DELETE'
//       ) || [])
//     ]

//     // Apply filters if any
//     if (paginationOptions.filters && paginationOptions.filters.length > 0) {
//       paginationOptions.filters.forEach((filter) => {
//         if (filter.type === 'contains' && filter.filter) {
//           filteredData = filteredData.filter((item) => {
//             const fieldValue = item[filter.field]
//             return (
//               fieldValue &&
//               fieldValue
//                 .toString()
//                 .toLowerCase()
//                 .includes(filter.filter.toLowerCase())
//             )
//           })
//         }
//       })
//     }

//     // Apply sorting if any
//     if (
//       paginationOptions.sortOrders &&
//       paginationOptions.sortOrders.length > 0
//     ) {
//       paginationOptions.sortOrders.forEach((sort) => {
//         filteredData.sort((a, b) => {
//           const aVal = a[sort.field]
//           const bVal = b[sort.field]

//           let comparison = 0
//           if (aVal > bVal) comparison = 1
//           if (aVal < bVal) comparison = -1

//           return sort.direction === 'desc' ? -comparison : comparison
//         })
//       })
//     }

//     const total = filteredData.length
//     const startIndex = (paginationOptions.page - 1) * paginationOptions.size
//     const endIndex = startIndex + paginationOptions.size
//     const paginatedItems = filteredData.slice(startIndex, endIndex)

//     return {
//       data: {
//         allocationAgreements: paginatedItems,
//         pagination: {
//           page: paginationOptions.page,
//           size: paginationOptions.size,
//           total
//         }
//       },
//       error: null,
//       isError: false,
//       isLoading: false
//     }
//   }, [data?.allocationAgreements, paginationOptions])

//   const gridOptions = useMemo(
//     () => ({
//       overlayNoRowsTemplate: t(
//         'allocationAgreement:noAllocationAgreementsFound'
//       ),
//       autoSizeStrategy: {
//         type: 'fitCellContents',
//         defaultMinWidth: 50,
//         defaultMaxWidth: 600
//       },
//       enableCellTextSelection: true,
//       ensureDomOrder: true
//     }),
//     [t]
//   )

//   const defaultColDef = useMemo(
//     () => ({
//       floatingFilter: false,
//       filter: false,
//       cellRenderer:
//         status === COMPLIANCE_REPORT_STATUSES.DRAFT ? LinkRenderer : undefined,
//       cellRendererParams: {
//         url: () => 'allocation-agreements'
//       }
//     }),
//     [status]
//   )

//   const getRowId = (params) => {
//     return params.data.allocationAgreementId.toString()
//   }

//   return (
//     <Grid2 className="allocation-agreement-container" mx={-1}>
//       <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
//         <BCGridViewer
//           gridKey="allocation-agreements"
//           gridRef={gridRef}
//           columnDefs={allocAgrmtSummaryColDefs(t)}
//           queryData={paginatedData}
//           dataKey="allocationAgreements"
//           getRowId={getRowId}
//           gridOptions={gridOptions}
//           enableCopyButton={false}
//           defaultColDef={defaultColDef}
//           suppressPagination={(data?.allocationAgreements?.length || 0) <= 10}
//           paginationOptions={paginationOptions}
//           onPaginationChange={(newPagination) =>
//             setPaginationOptions((prev) => ({
//               ...prev,
//               ...newPagination
//             }))
//           }
//         />
//       </BCBox>
//     </Grid2>
//   )
// }

// AllocationAgreementSummary.displayName = 'AllocationAgreementSummary'
