import BCBox from '@/components/BCBox'
import Grid2 from '@mui/material/Grid2'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { LinkRenderer } from '@/utils/grid/cellRenderers'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import {
  defaultInitialPagination,
  type PaginationOptions,
  type PaginationFilter,
  type PaginationSortOrder
} from '@/constants/schedules'
import type { GetRowIdParams, GridOptions } from 'ag-grid-community'
import type {
  BCGridRow,
  BCGridQueryData,
  BCGridRef,
  BCPaginationOptions
} from '@/components/BCDataGrid/types'
import { allocationAgreementSummaryColDef } from './_schema'

interface AllocationAgreement extends BCGridRow {
  allocationAgreementId: number | string
  actionType?: string | null
}

interface AllocationAgreementSummaryProps {
  data?: { allocationAgreements?: AllocationAgreement[] } | null
  status?: string
  isEarlyIssuance?: boolean
}

interface SummaryFilter extends PaginationFilter {
  field: string
  type: string
  filter?: string
}

interface SummarySortOrder extends PaginationSortOrder {
  field: string
  direction: string
}

interface SummaryPagination extends Omit<
  PaginationOptions,
  'filters' | 'sortOrders'
> {
  filters: SummaryFilter[]
  sortOrders: SummarySortOrder[]
  [key: string]: unknown
}

const compareValues = (leftValue: unknown, rightValue: unknown): number => {
  // Type assertions let TypeScript accept the original JavaScript relational
  // comparison. They do not alter the runtime operands or coercion behavior.
  const left = leftValue as string | number
  const right = rightValue as string | number
  if (left > right) return 1
  if (left < right) return -1
  return 0
}

export const AllocationAgreementSummary = ({
  data,
  status,
  isEarlyIssuance
}: AllocationAgreementSummaryProps) => {
  const [paginationOptions, setPaginationOptions] = useState<SummaryPagination>(
    defaultInitialPagination as SummaryPagination
  )
  const gridRef = useRef<BCGridRef['current']>(null)
  const { t } = useTranslation(['common', 'allocationAgreement'])

  // Client-side pagination logic
  const paginatedData = useMemo<BCGridQueryData<AllocationAgreement>>(() => {
    if (!data?.allocationAgreements) {
      return {
        data: {
          allocationAgreements: [],
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

    let filteredData: AllocationAgreement[] = [
      ...(data.allocationAgreements.filter(
        (item) => item.actionType !== 'DELETE'
      ) || [])
    ]

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
        allocationAgreements: paginatedItems,
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
  }, [data?.allocationAgreements, paginationOptions])

  const gridOptions = useMemo<GridOptions<BCGridRow>>(
    () => ({
      overlayNoRowsTemplate: t(
        'allocationAgreement:noAllocationAgreementsFound'
      ),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      },
      enableCellTextSelection: true,
      ensureDomOrder: true
    }),
    [t]
  )

  const defaultColDef = useMemo(
    () => ({
      floatingFilter: false,
      filter: false,
      cellRenderer:
        status === COMPLIANCE_REPORT_STATUSES.DRAFT ? LinkRenderer : undefined,
      cellRendererParams: {
        url: () => 'allocation-agreements'
      }
    }),
    [status]
  )

  const columns = useMemo(
    () => allocationAgreementSummaryColDef(isEarlyIssuance!),
    [isEarlyIssuance]
  )

  const getRowId = (params: GetRowIdParams<BCGridRow>) => {
    return (params.data!.allocationAgreementId as string | number).toString()
  }

  return (
    <Grid2 className="allocation-agreement-container" mx={-1}>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey="allocation-agreements"
          gridRef={gridRef}
          columnDefs={columns}
          queryData={paginatedData}
          dataKey="allocationAgreements"
          getRowId={getRowId}
          gridOptions={gridOptions}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          suppressPagination={(data?.allocationAgreements?.length || 0) <= 10}
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination: BCPaginationOptions) =>
            setPaginationOptions(
              (prev) => ({ ...prev, ...newPagination }) as SummaryPagination
            )
          }
          enablePageCaching={false}
        />
      </BCBox>
    </Grid2>
  )
}

AllocationAgreementSummary.displayName = 'AllocationAgreementSummary'
