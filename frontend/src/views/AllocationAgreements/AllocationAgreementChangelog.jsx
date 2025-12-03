import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import {
  useComplianceReportWithCache,
  useGetChangeLog
} from '@/hooks/useComplianceReports'
import { defaultInitialPagination } from '@/constants/schedules'
import colors from '@/themes/base/colors'
import { Box } from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { changelogColDefs, changelogCommonColDefs } from './_schema'
import { useParams } from 'react-router-dom'

export const AllocationAgreementChangelog = ({ isEarlyIssuance = false }) => {
  const { t } = useTranslation(['common', 'allocationAgreement', 'report'])
  // State for pagination - one per changelog item
  const [paginationStates, setPaginationStates] = useState({})

  const { complianceReportId, compliancePeriod } = useParams()
  const { data: currentReport, isLoading: currentReportLoading } =
    useComplianceReportWithCache(complianceReportId)

  const { data: changelogData, isLoading: changelogDataLoading } =
    useGetChangeLog({
      complianceReportGroupUuid:
        currentReport?.report?.complianceReportGroupUuid,
      dataType: 'allocation-agreements'
    })

  const getRowId = (params) => {
    return params.data.allocationAgreementId.toString()
  }

  const gridOptions = (highlight = true) => ({
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
      if (params.data.actionType === 'DELETE') {
        return {
          backgroundColor: colors.alerts.error.background
        }
      }
      if (params.data.actionType === 'CREATE') {
        return {
          backgroundColor: colors.alerts.success.background
        }
      }
    }
  })

  // Client-side pagination function
  const getPaginatedData = (
    allocationAgreements,
    index,
    isCurrentOrOriginalVersion
  ) => {
    const shouldPaginate =
      isCurrentOrOriginalVersion || allocationAgreements.length >= 10

    if (!shouldPaginate) {
      // No pagination for versions that don't meet criteria
      return { data: { items: allocationAgreements } }
    }

    const paginationOptions =
      paginationStates[index] || defaultInitialPagination
    let filteredData = [...allocationAgreements]

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

  const handlePaginationChange = (index) => (newPagination) => {
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
        const shouldPaginate = item.allocationAgreements.length >= 10
        const paginationOptions =
          paginationStates[i] || defaultInitialPagination
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
                    ? changelogCommonColDefs(false, isEarlyIssuance)
                    : changelogColDefs(true, isEarlyIssuance)
                }
                queryData={queryData}
                getRowId={getRowId}
                suppressPagination={!shouldPaginate}
                gridOptions={
                  isCurrentOrOriginalVersion
                    ? gridOptions(false)
                    : gridOptions()
                }
                defaultColDef={{
                  floatingFilter: false,
                  filter: false,
                  sortable: false
                }}
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
