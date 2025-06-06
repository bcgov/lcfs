import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { LinkRenderer } from '@/utils/grid/cellRenderers'
import Grid2 from '@mui/material/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { finalSupplyEquipmentSummaryColDefs } from '@/views/FinalSupplyEquipments/_schema.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'
import GeoMapping from './GeoMapping'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'

export const FinalSupplyEquipmentSummary = ({ data, status }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [showMap, setShowMap] = useState(false)
  const { complianceReportId } = useParams()

  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )

  const gridRef = useRef()
  const { t } = useTranslation(['common', 'finalSupplyEquipment'])
  const location = useLocation()

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  // Client-side pagination logic
  const paginatedData = useMemo(() => {
    if (!data?.finalSupplyEquipments) {
      return {
        data: {
          finalSupplyEquipments: [],
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

    let filteredData = [...data.finalSupplyEquipments]

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
        // Add more filter types as needed (equals, startsWith, etc.)
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
        finalSupplyEquipments: paginatedItems,
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
  }, [data?.finalSupplyEquipments, paginationOptions])

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t(
        'finalSupplyEquipment:noFinalSupplyEquipmentsFound'
      ),
      autoSizeStrategy: {
        type: 'fitCellContents',
        defaultMinWidth: 50,
        defaultMaxWidth: 600
      },
      enableCellTextSelection: true, // enables text selection on the grid
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
        url: () => 'final-supply-equipments'
      }
    }),
    [status]
  )

  const columns = useMemo(() => {
    return finalSupplyEquipmentSummaryColDefs(t, status)
  }, [t, status])

  const getRowId = (params) => {
    return params.data.finalSupplyEquipmentId.toString()
  }

  return (
    <Grid2 className="final-supply-equipment-container" mx={-1}>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey="final-supply-equipments"
          gridRef={gridRef}
          columnDefs={columns}
          queryData={paginatedData}
          dataKey="finalSupplyEquipments"
          getRowId={getRowId}
          gridOptions={gridOptions}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          suppressPagination={data?.finalSupplyEquipments.length <= 10}
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({
              ...prev,
              ...newPagination
            }))
          }
        />
      </BCBox>
      <>
        {/* Toggle Map Switch */}
        <FormControlLabel
          control={
            <Switch
              sx={{ mt: -1 }}
              checked={showMap}
              onChange={() => setShowMap(!showMap)}
            />
          }
          label={showMap ? 'Hide Map' : 'Show Map'}
          sx={{ mt: 2 }}
        />

        {/* Conditional Rendering of MapComponent */}
        {showMap && <GeoMapping complianceReportId={complianceReportId} />}
      </>
    </Grid2>
  )
}

FinalSupplyEquipmentSummary.displayName = 'FinalSupplyEquipmentSummary'
