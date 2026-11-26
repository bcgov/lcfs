import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import {
  useComplianceReportWithCache,
  useGetChangeLog
} from '@/hooks/useComplianceReports'
import {
  defaultInitialPagination,
  type PaginationFilter,
  type PaginationOptions,
  type PaginationSortOrder
} from '@/constants/schedules'
import colors from '@/themes/base/colors'
import Box from '@mui/material/Box'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { changelogColDefs, changelogCommonColDefs } from './_schema'
import { useParams } from 'react-router-dom'
import { useOtherUsesOptions } from '@/hooks/useOtherUses'
import type { GetRowIdParams, GridOptions } from 'ag-grid-community'
import type {
  BCGridRow,
  BCPaginationOptions
} from '@/components/BCDataGrid/types'
import type { OptionsData } from '@/types/schema'

interface OtherUseChange extends BCGridRow {
  otherUsesId: number | string
  actionType?: string
}

interface OtherUseVersion {
  version: number
  nickname: string
  otherUses: OtherUseChange[]
}

interface OtherUseChangelogFilter extends PaginationFilter {
  field: string
  type: string
  filter?: string
}

interface OtherUseChangelogSortOrder extends PaginationSortOrder {
  field: string
  direction: string
}

interface OtherUseChangelogPagination extends Omit<
  PaginationOptions,
  'filters' | 'sortOrders'
> {
  filters: OtherUseChangelogFilter[]
  sortOrders: OtherUseChangelogSortOrder[]
  [key: string]: unknown
}

const compareValues = (leftValue: unknown, rightValue: unknown): number => {
  // Keep JavaScript's relational comparison and coercion behavior.
  const left = leftValue as string | number
  const right = rightValue as string | number
  if (left > right) return 1
  if (left < right) return -1
  return 0
}

export const OtherUsesChangelog = () => {
  const { t } = useTranslation(['common', 'otherUses', 'report'])
  const { complianceReportId, compliancePeriod } = useParams<{
    complianceReportId: string
    compliancePeriod: string
  }>()
  const { data: optionsData, isLoading: optionsLoading } = useOtherUsesOptions({
    compliancePeriod
  })
  const { data: currentReport, isLoading: currentReportLoading } =
    useComplianceReportWithCache(complianceReportId!)

  // State for pagination - one per changelog item
  const [paginationStates, setPaginationStates] = useState<
    Record<number, OtherUseChangelogPagination>
  >({})

  const { data: changelogData, isLoading: changelogDataLoading } =
    useGetChangeLog<OtherUseVersion[]>({
      complianceReportGroupUuid:
        currentReport?.report.complianceReportGroupUuid,
      dataType: 'other-uses'
    })

  const getRowId = (params: GetRowIdParams<BCGridRow>) => {
    const otherUse = params.data as OtherUseChange
    return otherUse.otherUsesId.toString()
  }

  const currentOrOriginalColumnDefs = useMemo(
    () =>
      changelogCommonColDefs(
        false,
        parseInt(compliancePeriod ?? ''),
        optionsData as OptionsData
      ),
    [compliancePeriod, optionsData]
  )

  const changedColumnDefs = useMemo(
    () =>
      changelogColDefs(
        true,
        parseInt(compliancePeriod ?? ''),
        optionsData as OptionsData
      ),
    [compliancePeriod, optionsData]
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
    overlayNoRowsTemplate: t('otherUses:noOtherUsesFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
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
    otherUses: OtherUseChange[],
    index: number,
    isCurrentOrOriginalVersion: boolean
  ) => {
    const shouldPaginate = isCurrentOrOriginalVersion || otherUses.length >= 10

    if (!shouldPaginate) {
      // No pagination for versions that don't meet criteria
      return { data: { items: otherUses } }
    }

    const paginationOptions =
      paginationStates[index] || defaultInitialPagination
    let filteredData = [...otherUses]

    // Apply filters if any
    if (paginationOptions.filters && paginationOptions.filters.length > 0) {
      paginationOptions.filters.forEach((filter) => {
        if (
          filter.type === 'contains' &&
          typeof filter.field === 'string' &&
          typeof filter.filter === 'string'
        ) {
          const searchText = filter.filter.toLowerCase()
          filteredData = filteredData.filter((item) => {
            const fieldValue = item[filter.field]
            return (
              fieldValue &&
              fieldValue.toString().toLowerCase().includes(searchText)
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
        if (!sort.field) return
        filteredData.sort((a, b) => {
          const aVal = a[sort.field]
          const bVal = b[sort.field]
          const comparison = compareValues(aVal, bVal)
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
        [index]: {
          ...(prev[index] || defaultInitialPagination),
          ...newPagination
        } as OtherUseChangelogPagination
      }))
    }

  if (changelogDataLoading || currentReportLoading || optionsLoading) {
    return <Loading />
  }

  return (
    <Box>
      {changelogData?.map((item, i) => {
        const isCurrentOrOriginalVersion = i === 0 || item.version === 0
        const shouldPaginate = item.otherUses.length >= 10
        const paginationOptions =
          paginationStates[i] || defaultInitialPagination
        const queryData = getPaginatedData(
          item.otherUses,
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
                gridKey={`other-uses-changelog-${i}`}
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
