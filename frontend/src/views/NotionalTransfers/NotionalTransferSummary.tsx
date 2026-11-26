import { useParams } from 'react-router-dom'
import BCBox from '@/components/BCBox'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { LinkRenderer } from '@/utils/grid/cellRenderers'
import { notionalTransferSummaryColDefs } from '@/views/NotionalTransfers/_schema'
import Grid2 from '@mui/material/Grid2'
import { useMemo, useRef, useState } from 'react'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import {
  defaultInitialPagination,
  type PaginationOptions
} from '@/constants/schedules'
import { REPORT_SCHEDULES } from '@/constants/common'
import useComplianceReportStore from '@/stores/useComplianceReportStore'
import type {
  BCGridQueryData,
  BCGridRow,
  BCPaginationFilter,
  BCPaginationOptions,
  BCSortOrder
} from '@/components/BCDataGrid/types'
import type { GetRowIdParams } from 'ag-grid-community'

interface NotionalTransfer extends BCGridRow {
  notionalTransferId: number | string
  actionType?: string | null
}

interface NotionalTransferSummaryProps {
  data?: { notionalTransfers?: NotionalTransfer[] } | null
  status?: string
}

interface NotionalTransferPagination extends BCPaginationOptions {
  page: number
  size: number
  filters: Array<
    BCPaginationFilter & { field: string; type: string; filter?: string }
  >
  sortOrders: Array<BCSortOrder & { field: string; direction: string }>
}

const normalizePagination = (
  options: BCPaginationOptions | PaginationOptions
): NotionalTransferPagination => ({
  page: options.page ?? 1,
  size: options.size ?? 10,
  filters: (options.filters ?? []).map((filter) => ({
    field: typeof filter.field === 'string' ? filter.field : '',
    type: typeof filter.type === 'string' ? filter.type : '',
    filter: typeof filter.filter === 'string' ? filter.filter : undefined
  })),
  sortOrders: (options.sortOrders ?? []).map((sort) => ({
    field: typeof sort.field === 'string' ? sort.field : '',
    direction: typeof sort.direction === 'string' ? sort.direction : 'asc'
  }))
})

export const NotionalTransferSummary = ({
  data,
  status
}: NotionalTransferSummaryProps) => {
  const [paginationOptions, setPaginationOptions] =
    useState<NotionalTransferPagination>(
      normalizePagination(defaultInitialPagination)
    )
  const gridRef = useRef(null)
  const { compliancePeriod } = useParams()

  // Client-side pagination logic
  const paginatedData = useMemo<BCGridQueryData<NotionalTransfer>>(() => {
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

    let filteredData: NotionalTransfer[] = [
      ...data.notionalTransfers.filter((item) => item.actionType !== 'DELETE')
    ]

    // Apply filters if any
    if (paginationOptions.filters && paginationOptions.filters.length > 0) {
      paginationOptions.filters.forEach((filter) => {
        const filterText = filter.filter
        if (
          filter.type === 'contains' &&
          typeof filterText === 'string' &&
          filterText
        ) {
          filteredData = filteredData.filter((item) => {
            const fieldValue = item[filter.field]
            return (
              fieldValue &&
              fieldValue
                .toString()
                .toLowerCase()
                .includes(filterText.toLowerCase())
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
          const aValue = a[sort.field]
          const bValue = b[sort.field]
          const aVal =
            typeof aValue === 'string' ||
            typeof aValue === 'number' ||
            typeof aValue === 'boolean'
              ? aValue
              : undefined
          const bVal =
            typeof bValue === 'string' ||
            typeof bValue === 'number' ||
            typeof bValue === 'boolean'
              ? bValue
              : undefined

          let comparison = 0
          if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
            if (aVal > bVal) comparison = 1
            if (aVal < bVal) comparison = -1
          } else if (
            (typeof aVal === 'string' || typeof aVal === 'number') &&
            (typeof bVal === 'string' || typeof bVal === 'number')
          ) {
            if (aVal > bVal) comparison = 1
            if (aVal < bVal) comparison = -1
          }

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

  const getRowId = (params: GetRowIdParams<BCGridRow>) => {
    const id = params.data?.notionalTransferId
    if (typeof id !== 'string' && typeof id !== 'number') {
      throw new Error('Notional transfer row is missing its ID')
    }
    return id.toString()
  }
  const { currentReport } = useComplianceReportStore()
  const isEarlyIssuance =
    currentReport?.report?.reportingFrequency === REPORT_SCHEDULES.QUARTERLY

  const columnDefs = useMemo(
    () =>
      notionalTransferSummaryColDefs(
        isEarlyIssuance,
        parseInt(compliancePeriod ?? '')
      ),
    [isEarlyIssuance, compliancePeriod]
  )

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

  return (
    <Grid2 className="notional-transfer-container" mx={-1}>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey="notional-transfers"
          gridRef={gridRef}
          getRowId={getRowId}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          queryData={paginatedData}
          dataKey="notionalTransfers"
          suppressPagination={(data?.notionalTransfers?.length ?? 0) <= 10}
          autoSizeStrategy={{
            type: 'fitCellContents',
            defaultMinWidth: 80,
            defaultMaxWidth: 800
          }}
          enableCellTextSelection
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination: BCPaginationOptions) =>
            setPaginationOptions((prev) =>
              normalizePagination({ ...prev, ...newPagination })
            )
          }
          enablePageCaching={false}
        />
      </BCBox>
    </Grid2>
  )
}

NotionalTransferSummary.displayName = 'NotionalTransferSummary'
