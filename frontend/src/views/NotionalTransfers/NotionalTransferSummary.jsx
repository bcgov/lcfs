import { useParams } from 'react-router-dom'
import BCBox from '@/components/BCBox'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { notionalTransferSummaryColDefs } from '@/views/NotionalTransfers/_schema.jsx'
import Grid2 from '@mui/material/Grid2'
import { useCallback, useMemo, useRef, useState } from 'react'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { defaultInitialPagination } from '@/constants/schedules'
import { REPORT_SCHEDULES } from '@/constants/common'
import useComplianceReportStore from '@/stores/useComplianceReportStore'

export const NotionalTransferSummary = ({ data, status }) => {
  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )
  const gridRef = useRef()
  const { complianceReportId, compliancePeriod } = useParams()

  // Client-side pagination logic
  const paginatedData = useMemo(() => {
    if (!data?.notionalTransfers) {
      return {
        data: {
          notionalTransfers: [],
          pagination: {
            page: 1,
            size: paginationOptions.size,
            total: 0
          }
        },
        error: null,
        isError: false,
        isLoading: false
      }
    }

    let filteredData = [
      ...data.notionalTransfers.filter((item) => item.actionType !== 'DELETE')
    ]

    // Apply filters if any
    if (paginationOptions.filters && paginationOptions.filters.length > 0) {
      paginationOptions.filters.forEach((filter) => {
        if (filter.type === 'contains' && filter.filter) {
          filteredData = filteredData.filter((item) => {
            const fieldValue = item[filter.field]
            return (
              fieldValue &&
              fieldValue
                .toString()
                .toLowerCase()
                .includes(filter.filter.toLowerCase())
            )
          })
        }
      })
    }

    // Apply sorting if any
    if (
      paginationOptions.sortOrders &&
      paginationOptions.sortOrders.length > 0
    ) {
      paginationOptions.sortOrders.forEach((sort) => {
        filteredData.sort((a, b) => {
          const aVal = a[sort.field]
          const bVal = b[sort.field]

          let comparison = 0
          if (aVal > bVal) comparison = 1
          if (aVal < bVal) comparison = -1

          return sort.direction === 'desc' ? -comparison : comparison
        })
      })
    }

    const total = filteredData.length
    const startIndex = (paginationOptions.page - 1) * paginationOptions.size
    const endIndex = startIndex + paginationOptions.size
    const paginatedItems = filteredData.slice(startIndex, endIndex)

    return {
      data: {
        notionalTransfers: paginatedItems,
        pagination: {
          page: paginationOptions.page,
          size: paginationOptions.size,
          total
        }
      },
      error: null,
      isError: false,
      isLoading: false
    }
  }, [data?.notionalTransfers, paginationOptions])

  const getRowId = (params) => params.data.notionalTransferId.toString()
  const { currentReport } = useComplianceReportStore()
  const isEarlyIssuance =
    currentReport?.report?.reportingFrequency === REPORT_SCHEDULES.QUARTERLY
  const defaultColDef = useMemo(
    () => ({
      floatingFilter: false,
      filter: false,
      cellRenderer:
        status === COMPLIANCE_REPORT_STATUSES.DRAFT ? LinkRenderer : undefined,
      cellRendererParams: {
        url: () => 'notional-transfers'
      }
    }),
    [status]
  )

  const onFirstDataRendered = useCallback((params) => {
    params.api?.autoSizeAllColumns?.()
  }, [])

  return (
    <Grid2 className="notional-transfer-container" mx={-1}>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey="notional-transfers"
          gridRef={gridRef}
          getRowId={getRowId}
          columnDefs={notionalTransferSummaryColDefs(
            isEarlyIssuance,
            parseInt(compliancePeriod)
          )}
          defaultColDef={defaultColDef}
          queryData={paginatedData}
          dataKey="notionalTransfers"
          suppressPagination={data?.notionalTransfers?.length <= 10}
          autoSizeStrategy={{
            type: 'fitCellContents',
            defaultMinWidth: 80,
            defaultMaxWidth: 800
          }}
          enableCellTextSelection
          onFirstDataRendered={onFirstDataRendered}
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({
              ...prev,
              ...newPagination
            }))
          }
          enablePageCaching={false}
        />
      </BCBox>
    </Grid2>
  )
}

NotionalTransferSummary.displayName = 'NotionalTransferSummary'
