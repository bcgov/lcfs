import BCBox from '@/components/BCBox'
import { ComplianceUnitsTotal } from '@/views/ComplianceReports/components/ComplianceUnitsTotal'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { LinkRenderer } from '@/utils/grid/cellRenderers'
import { fuelExportSummaryColDefs } from '@/views/FuelExports/_schema'
import Grid2 from '@mui/material/Grid2'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { defaultInitialPagination } from '@/constants/schedules'

interface FuelExport {
  fuelExportId: number | string
  actionType?: string
  fuelType?: { fuelType?: string }
  [key: string]: any
}

interface FuelExportSummaryProps {
  data?: {
    fuelExports?: FuelExport[]
    totalComplianceUnits?: number | null
  }
  status?: string
}

interface PaginationFilter {
  field: string
  type: string
  filter?: string
}

interface PaginationSort {
  field: string
  direction: 'asc' | 'desc'
}

interface PaginationOptions {
  page: number
  size: number
  filters?: PaginationFilter[]
  sortOrders?: PaginationSort[]
}

export const FuelExportSummary = ({
  data,
  status
}: FuelExportSummaryProps) => {
  const [paginationOptions, setPaginationOptions] = useState<PaginationOptions>(
    defaultInitialPagination
  )
  const gridRef = useRef(null)
  const { t } = useTranslation(['common', 'fuelExport'])

  // Client-side pagination logic
  const paginatedData = useMemo(() => {
    if (!data?.fuelExports) {
      return {
        data: {
          fuelExports: [] as FuelExport[],
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

    let filteredData: FuelExport[] = [
      ...data.fuelExports.filter((item) => item.actionType !== 'DELETE')
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
                .includes(filter.filter!.toLowerCase())
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
        fuelExports: paginatedItems,
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
  }, [data?.fuelExports, paginationOptions])

  const showFuelTypeOther = paginatedData.data.fuelExports.some(
    (item) => item.fuelType?.fuelType === 'Other'
  )

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('fuelExport:noFuelExportsFound'),
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
        url: () => 'fuel-exports'
      }
    }),
    [status]
  )

  const getRowId = (params: { data: FuelExport }) => {
    return params.data.fuelExportId.toString()
  }

  return (
    <Grid2 className="fuel-export-container" mx={-1}>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        {data?.totalComplianceUnits !== undefined &&
          data?.totalComplianceUnits !== null && (
            <ComplianceUnitsTotal
              label={t('fuelExport:totalComplianceUnits')}
              value={data.totalComplianceUnits}
              dataTest="fuel-export-total-compliance-units"
            />
          )}
        <BCGridViewer
          gridKey="fuel-exports"
          gridRef={gridRef}
          queryData={paginatedData}
          dataKey="fuelExports"
          columnDefs={fuelExportSummaryColDefs(showFuelTypeOther)}
          getRowId={getRowId}
          gridOptions={gridOptions}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          suppressPagination={(data?.fuelExports?.length || 0) <= 10}
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination: Partial<PaginationOptions>) =>
            setPaginationOptions((prev) => ({
              ...prev,
              ...newPagination
            }))
          }
          enablePageCaching={false}
        />
      </BCBox>
    </Grid2>
  )
}

FuelExportSummary.displayName = 'FuelExportSummary'
