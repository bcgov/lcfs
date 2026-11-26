import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import {
  useComplianceReportWithCache,
  useGetChangeLog
} from '@/hooks/useComplianceReports'
import {
  defaultInitialPagination,
  type PaginationOptions,
  type PaginationFilter,
  type PaginationSortOrder
} from '@/constants/schedules'
import colors from '@/themes/base/colors'
import Box from '@mui/material/Box'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { changelogColDefs, changelogCommonColDefs } from './_schema'
import { useParams } from 'react-router-dom'
import type { GetRowIdParams, GridOptions } from 'ag-grid-community'
import type {
  BCGridRow,
  BCPaginationOptions
} from '@/components/BCDataGrid/types'

interface AllocationAgreement extends BCGridRow {
  allocationAgreementId: number | string
  actionType?: string
}

interface AllocationAgreementVersion {
  version: number
  nickname: string
  allocationAgreements: AllocationAgreement[]
}

interface ChangelogFilter extends PaginationFilter {
  field: string
  type: string
  filter?: string
}

interface ChangelogSortOrder extends PaginationSortOrder {
  field: string
  direction: string
}

interface ChangelogPagination extends Omit<
  PaginationOptions,
  'filters' | 'sortOrders'
> {
  filters: ChangelogFilter[]
  sortOrders: ChangelogSortOrder[]
  [key: string]: unknown
}

const compareValues = (leftValue: unknown, rightValue: unknown): number => {
  // Keep the JavaScript relational comparison and its coercion semantics.
  const left = leftValue as string | number
  const right = rightValue as string | number
  if (left > right) return 1
  if (left < right) return -1
  return 0
}

interface AllocationAgreementChangelogProps {
  isEarlyIssuance?: boolean
}

export const AllocationAgreementChangelog = ({
  isEarlyIssuance = false
}: AllocationAgreementChangelogProps) => {
  const { t } = useTranslation(['common', 'allocationAgreement', 'report'])
  // State for pagination - one per changelog item
  const [paginationStates, setPaginationStates] = useState<
    Record<number, ChangelogPagination>
  >({})

  const { complianceReportId } = useParams()
  const { data: currentReport, isLoading: currentReportLoading } =
    useComplianceReportWithCache(complianceReportId!)

  const { data: changelogData, isLoading: changelogDataLoading } =
    useGetChangeLog<AllocationAgreementVersion[]>({
      complianceReportGroupUuid:
        currentReport?.report?.complianceReportGroupUuid,
      dataType: 'allocation-agreements'
    })

  const getRowId = (params: GetRowIdParams<BCGridRow>) => {
    return (params.data!.allocationAgreementId as string | number).toString()
  }

  const currentOrOriginalColumnDefs = useMemo(
    () => changelogCommonColDefs(false, isEarlyIssuance),
    [isEarlyIssuance]
  )

  const changedColumnDefs = useMemo(
    () => changelogColDefs(true, isEarlyIssuance),
    [isEarlyIssuance]
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
    overlayNoRowsTemplate: t('allocationAgreement:noAllocationAgreementsFound'),
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
    allocationAgreements: AllocationAgreement[],
    index: number,
    isCurrentOrOriginalVersion: boolean
  ) => {
    const shouldPaginate =
      isCurrentOrOriginalVersion || allocationAgreements.length >= 10

    if (!shouldPaginate) {
      // No pagination for versions that don't meet criteria
      return { data: { items: allocationAgreements } }
    }

    const paginationOptions = (paginationStates[index] ||
      defaultInitialPagination) as ChangelogPagination
    let filteredData = [...allocationAgreements]

    // Apply filters if any
    if (paginationOptions.filters && paginationOptions.filters.length > 0) {
      paginationOptions.filters.forEach((filter) => {
        const filterText = filter.filter
        if (filter.type === 'contains' && filterText) {
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
          const comparison = compareValues(a[sort.field], b[sort.field])
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
        } as ChangelogPagination
      }))
    }

  if (changelogDataLoading || currentReportLoading) {
    return <Loading />
  }

  return (
    <Box>
      {changelogData?.map((item, i) => {
        const isCurrentOrOriginalVersion = i === 0 || item.version === 0
        const shouldPaginate = item.allocationAgreements.length >= 10
        const paginationOptions = (paginationStates[i] ||
          defaultInitialPagination) as ChangelogPagination
        const queryData = getPaginatedData(
          item.allocationAgreements,
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
                gridKey={`allocation-agreements-changelog-${i}`}
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
