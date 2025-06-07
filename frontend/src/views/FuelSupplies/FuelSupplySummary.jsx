import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { fuelSupplySummaryColDef } from '@/views/FuelSupplies/_schema.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'
import Grid2 from '@mui/material/Grid2'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const FuelSupplySummary = ({ data, status, isEarlyIssuance }) => {
  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )
  const gridRef = useRef()
  const { t } = useTranslation(['common', 'fuelSupply'])

  // Client-side pagination logic
  const paginatedData = useMemo(() => {
    if (!data?.fuelSupplies) {
      return {
        data: {
          fuelSupplies: [],
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

    let filteredData = [...data.fuelSupplies]

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
        fuelSupplies: paginatedItems,
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
  }, [data?.fuelSupplies, paginationOptions])

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('fuelSupply:noFuelSuppliesFound'),
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
        url: () => 'supply-of-fuel'
      }
    }),
    [status]
  )

  const getRowId = (params) => {
    return params.data.fuelSupplyId.toString()
  }

  return (
    <Grid2 className="fuel-supply-container" mx={-1}>
      <BCBox
        component="div"
        sx={{ height: '100%', width: '100%' }}
        data-test="fuel-supply-summary"
      >
        <BCGridViewer
          gridKey="fuel-supplies"
          gridRef={gridRef}
          columnDefs={fuelSupplySummaryColDef(isEarlyIssuance)}
          queryData={paginatedData}
          dataKey="fuelSupplies"
          getRowId={getRowId}
          gridOptions={gridOptions}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          suppressPagination={data?.fuelSupplies.length <= 10}
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

FuelSupplySummary.displayName = 'FuelSupplySummary'
