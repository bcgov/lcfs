import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { LinkRenderer } from '@/utils/grid/cellRenderers'
import Grid2 from '@mui/material/Grid2'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { finalSupplyEquipmentSummaryColDefs } from '@/views/FinalSupplyEquipments/_schema.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'
import GeoMapping from './GeoMapping'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import { useGetFSEReportingList } from '@/hooks/useFinalSupplyEquipment'

export const FinalSupplyEquipmentSummary = ({
  data,
  status,
  organizationId
}) => {
  const [showMap, setShowMap] = useState(false)
  const { complianceReportId } = useParams()

  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )
  const queryData = useGetFSEReportingList(
    complianceReportId,
    paginationOptions,
    {},
    organizationId,
    undefined
  )
  const { data: fseData, isLoading, isError, refetch } = queryData

  const gridRef = useRef()
  const { t } = useTranslation(['common', 'finalSupplyEquipment'])

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
        url: () => 'final-supply-equipments'
      }
    }),
    [status]
  )

  const columns = useMemo(() => {
    return finalSupplyEquipmentSummaryColDefs(t, status)
  }, [t, status])

  const getRowId = (params) => {
    return String(params.data.chargingEquipmentId)
  }
  const handlePaginationChange = useCallback((newPaginationOptions) => {
    setPaginationOptions(newPaginationOptions)
  }, [])

  return (
    <Grid2 className="final-supply-equipment-container" mx={-1}>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey="final-supply-equipments"
          gridRef={gridRef}
          columnDefs={columns}
          queryData={queryData}
          dataKey="finalSupplyEquipments"
          getRowId={getRowId}
          gridOptions={gridOptions}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          suppressPagination={(fseData?.pagination?.total || 0) <= 10}
          paginationOptions={paginationOptions}
          onPaginationChange={handlePaginationChange}
          enablePageCaching={false}
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
        {showMap && (
          <GeoMapping complianceReportId={complianceReportId} data={fseData} />
        )}
      </>
    </Grid2>
  )
}

FinalSupplyEquipmentSummary.displayName = 'FinalSupplyEquipmentSummary'
