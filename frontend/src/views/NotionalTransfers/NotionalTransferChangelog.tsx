import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import {
  useComplianceReportWithCache,
  useGetChangeLog
} from '@/hooks/useComplianceReports'
import {
  defaultInitialPagination,
  type PaginationOptions
} from '@/constants/schedules'
import colors from '@/themes/base/colors'
import Box from '@mui/material/Box'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { changelogColDefs, changelogCommonColDefs } from './_schema'
import { useParams } from 'react-router-dom'
import { REPORT_SCHEDULES } from '@/constants/common'
import type {
  BCGridRow,
  BCPaginationFilter,
  BCPaginationOptions,
  BCSortOrder
} from '@/components/BCDataGrid/types'
import type { GridOptions, GetRowIdParams } from 'ag-grid-community'

interface NotionalTransfer extends BCGridRow {
  notionalTransferId: number | string
  actionType?: string
}

interface NotionalTransferVersion {
  version: number
  nickname: string
  notionalTransfers: NotionalTransfer[]
}

interface ChangelogPagination extends BCPaginationOptions {
  page: number
  size: number
  filters: Array<
    BCPaginationFilter & { field: string; type: string; filter?: string }
  >
  sortOrders: Array<BCSortOrder & { field: string; direction: string }>
}

const normalizePagination = (
  options: BCPaginationOptions | PaginationOptions
): ChangelogPagination => ({
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

export const NotionalTransferChangelog = () => {
  const { t } = useTranslation(['common', 'notionalTransfer', 'report'])
  const { complianceReportId, compliancePeriod } = useParams()
  const { data: currentReport, isLoading: currentReportLoading } =
    useComplianceReportWithCache(complianceReportId!)
  const isEarlyIssuance =
    currentReport?.report?.reportingFrequency === REPORT_SCHEDULES.QUARTERLY

  // State for pagination - one per changelog item
  const [paginationStates, setPaginationStates] = useState<
    Record<number, ChangelogPagination>
  >({})

  const { data: changelogData, isLoading: changelogDataLoading } =
    useGetChangeLog<NotionalTransferVersion[]>({
      complianceReportGroupUuid:
        currentReport?.report.complianceReportGroupUuid,
      dataType: 'notional-transfers'
    })

  const getRowId = (params: GetRowIdParams<BCGridRow>) => {
    const id = params.data?.notionalTransferId
    if (typeof id !== 'string' && typeof id !== 'number') {
      throw new Error('Notional transfer row is missing its ID')
    }
    return id.toString()
  }

  const currentOrOriginalColumnDefs = useMemo(
    () =>
      changelogCommonColDefs(
        false,
        parseInt(compliancePeriod ?? ''),
        isEarlyIssuance
      ),
    [compliancePeriod, isEarlyIssuance]
  )

  const changedColumnDefs = useMemo(
    () =>
      changelogColDefs(true, parseInt(compliancePeriod ?? ''), isEarlyIssuance),
    [compliancePeriod, isEarlyIssuance]
  )

  const defaultColDef = useMemo(
    () => ({
      floatingFilter: false,
      filter: false,
      sortable: false
    }),
    []
  )

  const gridOptions = (highlight = true): GridOptions<BCGridRow> => ({
    overlayNoRowsTemplate: t('notionalTransfer:noNotionalTransfersFound'),
    autoSizeStrategy: {
      type: 'fitGridWidth',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    },
    enableCellTextSelection: true,
    ensureDomOrder: true,
    getRowStyle: (params) => {
      if (!highlight) return
      if (params.data?.actionType === 'DELETE') {
        return {
          backgroundColor: colors.alerts.error.background
        }
      }
      if (params.data?.actionType === 'CREATE') {
        return {
          backgroundColor: colors.alerts.success.background
        }
      }
    }
  })

  // Client-side pagination function
  const getPaginatedData = (
    notionalTransfers: NotionalTransfer[],
    index: number,
    isCurrentOrOriginalVersion: boolean
  ) => {
    const shouldPaginate =
      isCurrentOrOriginalVersion || notionalTransfers.length >= 10

    if (!shouldPaginate) {
      // No pagination for versions that don't meet criteria
      return { data: { items: notionalTransfers } }
    }

    const paginationOptions =
      paginationStates[index] || normalizePagination(defaultInitialPagination)
    let filteredData = [...notionalTransfers]

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
        items: paginatedItems,
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
  }

  const handlePaginationChange =
    (index: number) => (newPagination: BCPaginationOptions) => {
      setPaginationStates((prev) => ({
        ...prev,
        [index]: normalizePagination({
          ...(prev[index] || normalizePagination(defaultInitialPagination)),
          ...newPagination
        })
      }))
    }

  if (changelogDataLoading || currentReportLoading) {
    return <Loading />
  }

  return (
    <Box>
      {changelogData?.map((item, i) => {
        const isCurrentOrOriginalVersion = i === 0 || item.version === 0
        const shouldPaginate = item.notionalTransfers.length >= 10
        const paginationOptions =
          paginationStates[i] || normalizePagination(defaultInitialPagination)
        const queryData = getPaginatedData(
          item.notionalTransfers,
          i,
          isCurrentOrOriginalVersion
        )

        return (
          <Box mb={4} key={i}>
            <BCTypography variant="h6" color="primary" component="div" mb={2}>
              {item.nickname}
            </BCTypography>
            <Box>
              <BCGridViewer
                key={i}
                gridKey={`notional-transfers-changelog-${i}`}
                columnDefs={
                  isCurrentOrOriginalVersion
                    ? currentOrOriginalColumnDefs
                    : changedColumnDefs
                }
                queryData={queryData}
                getRowId={getRowId}
                suppressPagination={!shouldPaginate}
                gridOptions={
                  isCurrentOrOriginalVersion
                    ? gridOptions(false)
                    : gridOptions()
                }
                defaultColDef={defaultColDef}
                paginationOptions={
                  shouldPaginate ? paginationOptions : undefined
                }
                onPaginationChange={
                  shouldPaginate ? handlePaginationChange(i) : undefined
                }
                enablePageCaching={false}
              />
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
