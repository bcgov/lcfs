import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import {
  useComplianceReportWithCache,
  useGetChangeLog
} from '@/hooks/useComplianceReports'
import { defaultInitialPagination } from '@/constants/schedules'
import colors from '@/themes/base/colors'
import Box from '@mui/material/Box'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { changelogColDefs, changelogCommonColDefs } from './_schema'
import { useParams } from 'react-router-dom'
import type {
  BCGridRow,
  BCPaginationOptions
} from '@/components/BCDataGrid/types'
import type { ColDef, GridOptions } from 'ag-grid-community'

interface FuelExportChange extends BCGridRow {
  fuelExportId: number | string
  actionType?: string
}

interface FuelExportVersion {
  version: number
  nickname: string
  fuelExports: FuelExportChange[]
}

const compareValues = (left: unknown, right: unknown): number => {
  if (typeof left === 'string' && typeof right === 'string') {
    if (left > right) return 1
    if (left < right) return -1
    return 0
  }
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (leftNumber > rightNumber) return 1
  if (leftNumber < rightNumber) return -1
  return 0
}

export const FuelExportChangelog = () => {
  const { t } = useTranslation(['common', 'fuelExport', 'report'])
  const { complianceReportId } = useParams<{ complianceReportId: string }>()
  const { data: currentReport, isLoading: currentReportLoading } =
    useComplianceReportWithCache(complianceReportId!)

  // State for pagination - one per changelog item
  const [paginationStates, setPaginationStates] = useState<
    Record<number, BCPaginationOptions>
  >({})

  const { data: changelogData, isLoading: changelogDataLoading } =
    useGetChangeLog<FuelExportVersion[]>({
      complianceReportGroupUuid:
        currentReport?.report.complianceReportGroupUuid,
      dataType: 'fuel-exports'
    })

  const getRowId = (params: { data: BCGridRow }) => {
    return String(params.data.fuelExportId)
  }

  const currentOrOriginalColumnDefs = useMemo(
    () => changelogCommonColDefs(false),
    []
  )

  const changedColumnDefs = useMemo(() => changelogColDefs(), [])

  const defaultColDef = useMemo(
    (): ColDef<BCGridRow> => ({
      floatingFilter: false,
      filter: false,
      sortable: false
    }),
    []
  )

  const gridOptions = (highlight = true): GridOptions<BCGridRow> => ({
    overlayNoRowsTemplate: t('fuelExport:noFuelExportsFound'),
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
    fuelExports: FuelExportChange[],
    index: number,
    isCurrentOrOriginalVersion: boolean
  ) => {
    if (!isCurrentOrOriginalVersion) {
      // No pagination for non-current/original versions
      return { data: { items: fuelExports } }
    }

    const paginationOptions =
      paginationStates[index] || defaultInitialPagination
    const page = paginationOptions.page ?? defaultInitialPagination.page
    const size = paginationOptions.size ?? defaultInitialPagination.size
    let filteredData = [...fuelExports]

    // Apply filters if any
    if (paginationOptions.filters && paginationOptions.filters.length > 0) {
      paginationOptions.filters.forEach((filter) => {
        if (
          filter.type === 'contains' &&
          typeof filter.filter === 'string' &&
          filter.filter
        ) {
          const searchText = filter.filter.toLowerCase()
          const field = String(filter.field)
          filteredData = filteredData.filter((item) => {
            const fieldValue = item[field]
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
        const field = String(sort.field)
        filteredData.sort((a, b) => {
          const comparison = compareValues(a[field], b[field])

          return sort.direction === 'desc' ? -comparison : comparison
        })
      })
    }

    const total = filteredData.length
    const startIndex = (page - 1) * size
    const endIndex = startIndex + size
    const paginatedItems = filteredData.slice(startIndex, endIndex)

    return {
      data: {
        items: paginatedItems,
        pagination: {
          page,
          size,
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
        }
      }))
    }

  if (changelogDataLoading || currentReportLoading) {
    return <Loading />
  }

  return (
    <Box>
      {changelogData?.map((item, i) => {
        const isCurrentOrOriginalVersion = i === 0 || item.version === 0
        const shouldPaginate = item.fuelExports.length >= 10
        const paginationOptions =
          paginationStates[i] || defaultInitialPagination
        const queryData = getPaginatedData(
          item.fuelExports,
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
                gridKey={`fuel-exports-changelog-${i}`}
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
