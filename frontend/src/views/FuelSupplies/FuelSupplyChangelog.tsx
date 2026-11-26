import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import {
  useComplianceReportWithCache,
  useGetChangeLog
} from '@/hooks/useComplianceReports'
import { defaultInitialPagination } from '@/constants/schedules'
import { useFuelSupplyOptions } from '@/hooks/useFuelSupply'
import Box from '@mui/material/Box'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { changelogColDefs, changelogCommonColDefs } from './_schema'
import { useParams } from 'react-router-dom'
import { getFuelSupplyChangelogRowStyle, getFuelSupplyRowId } from './_utils'
import type { GridOptions, GetRowIdParams } from 'ag-grid-community'
import type {
  BCGridQueryData,
  BCGridRow,
  BCPaginationOptions
} from '@/components/BCDataGrid/types'

interface FuelSupplyChangelogRow extends Record<string, unknown> {
  fuelSupplyId: number | string
  actionType?: string
}

interface ChangelogEntry {
  version: number
  nickname: string
  fuelSupplies: FuelSupplyChangelogRow[]
}

type ChangelogPagination = {
  page: number
  size: number
  filters: Array<{ field?: string; type?: string; filter?: unknown }>
  sortOrders: Array<{ field?: string; direction?: string }>
}

const emptyChangelogPagination: ChangelogPagination = {
  ...defaultInitialPagination,
  filters: [],
  sortOrders: []
}

interface ChangelogQueryData extends BCGridQueryData<BCGridRow> {
  data: {
    [key: string]: unknown
    items: FuelSupplyChangelogRow[]
    pagination?: { page: number; size: number; total: number }
  }
  error?: null
  isError?: false
  isLoading?: false
}

export const FuelSupplyChangelog = ({
  isEarlyIssuance = false
}: {
  isEarlyIssuance?: boolean
}) => {
  const { complianceReportId, compliancePeriod } = useParams<{
    complianceReportId: string
    compliancePeriod: string
  }>()
  const { data: currentReport, isLoading: currentReportLoading } =
    useComplianceReportWithCache(complianceReportId!)
  const { data: optionsData, isLoading: optionsLoading } = useFuelSupplyOptions(
    { compliancePeriod }
  )
  const { t } = useTranslation(['common', 'fuelSupply', 'report'])

  // State for pagination - one per changelog item
  const [paginationStates, setPaginationStates] = useState<
    Record<number, ChangelogPagination>
  >({})

  const { data: changelogData, isLoading: changelogDataLoading } =
    useGetChangeLog<ChangelogEntry[]>({
      complianceReportGroupUuid:
        currentReport?.report.complianceReportGroupUuid,
      dataType: 'fuel-supplies'
    })

  const getRowId = (params: GetRowIdParams<BCGridRow>) => {
    const fuelSupplyId = params.data.fuelSupplyId
    if (typeof fuelSupplyId !== 'string' && typeof fuelSupplyId !== 'number') {
      throw new TypeError('Fuel supply row is missing its ID')
    }
    return getFuelSupplyRowId(fuelSupplyId)
  }

  const currentOrOriginalColumnDefs = useMemo(
    () =>
      changelogCommonColDefs(
        false,
        isEarlyIssuance,
        parseInt(compliancePeriod ?? ''),
        optionsData
      ),
    [isEarlyIssuance, compliancePeriod, optionsData]
  )

  const changedColumnDefs = useMemo(
    () =>
      changelogColDefs(
        true,
        isEarlyIssuance,
        parseInt(compliancePeriod ?? ''),
        optionsData
      ),
    [isEarlyIssuance, compliancePeriod, optionsData]
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
    overlayNoRowsTemplate: t('fuelSupply:noFuelSuppliesFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    },
    enableCellTextSelection: true,
    ensureDomOrder: true,
    getRowStyle: (params) =>
      getFuelSupplyChangelogRowStyle(params.data?.actionType, highlight)
  })

  // Client-side pagination function
  const getPaginatedData = (
    fuelSupplies: FuelSupplyChangelogRow[],
    index: number,
    isCurrentOrOriginalVersion: boolean
  ): ChangelogQueryData => {
    const shouldPaginate =
      isCurrentOrOriginalVersion || fuelSupplies.length >= 10

    if (!shouldPaginate) {
      // No pagination for versions that don't meet criteria
      return { data: { items: fuelSupplies } }
    }

    const paginationOptions =
      paginationStates[index] || emptyChangelogPagination
    let filteredData = [...fuelSupplies]

    // Apply filters if any
    if (paginationOptions.filters && paginationOptions.filters.length > 0) {
      paginationOptions.filters.forEach((filter) => {
        const searchTerm = filter.filter
        if (filter.type === 'contains' && typeof searchTerm === 'string') {
          filteredData = filteredData.filter((item) => {
            const fieldValue = filter.field ? item[filter.field] : undefined
            return (
              fieldValue &&
              fieldValue
                .toString()
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
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
          const aVal = (sort.field ? a[sort.field] : undefined) as
            | string
            | number
          const bVal = (sort.field ? b[sort.field] : undefined) as
            | string
            | number

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
          ...(prev[index] || emptyChangelogPagination),
          ...newPagination
        } as ChangelogPagination
      }))
    }

  if (changelogDataLoading || currentReportLoading || optionsLoading) {
    return <Loading />
  }

  return (
    <Box>
      {(changelogData as ChangelogEntry[] | undefined)?.map((item, i) => {
        const isCurrentOrOriginalVersion = i === 0 || item.version === 0
        const shouldPaginate = item.fuelSupplies.length >= 10
        const paginationOptions =
          paginationStates[i] || emptyChangelogPagination
        const queryData = getPaginatedData(
          item.fuelSupplies,
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
                gridKey={`fuel-supply-changelog-${i}`}
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
