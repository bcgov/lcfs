import BCBox from '@/components/BCBox'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { otherUsesSummaryColDefs } from '@/views/OtherUses/_schema.jsx'
import Grid2 from '@mui/material/Grid2'
import { useMemo, useRef, useState } from 'react'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'

export const OtherUsesSummary = ({ data, status }) => {
  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )
  const gridRef = useRef()

  // Client-side pagination logic
  const paginatedData = useMemo(() => {
    if (!data?.otherUses) {
      return {
        data: {
          otherUses: [],
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
      ...data.otherUses.filter((item) => item.actionType !== 'DELETE')
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
        otherUses: paginatedItems,
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
  }, [data?.otherUses, paginationOptions])

  const defaultColDef = useMemo(
    () => ({
      floatingFilter: false,
      filter: false,
      cellRenderer:
        status === COMPLIANCE_REPORT_STATUSES.DRAFT ? LinkRenderer : undefined,
      cellRendererParams: {
        url: () => 'fuels-other-use'
      }
    }),
    [status]
  )

  const getRowId = (params) => params.data.otherUsesId.toString()

  return (
    <Grid2 className="other-uses-container" data-test="container" mx={-1}>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey="other-uses"
          gridRef={gridRef}
          getRowId={getRowId}
          columnDefs={otherUsesSummaryColDefs}
          defaultColDef={defaultColDef}
          queryData={paginatedData}
          dataKey="otherUses"
          suppressPagination={data?.otherUses?.length <= 10}
          autoSizeStrategy={{
            type: 'fitCellContents',
            defaultMinWidth: 50,
            defaultMaxWidth: 600
          }}
          enableCellTextSelection
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({
              ...prev,
              ...newPagination
            }))
          }
        />
      </BCBox>
    </Grid2>
  )
}

OtherUsesSummary.displayName = 'OtherUsesSummary'
