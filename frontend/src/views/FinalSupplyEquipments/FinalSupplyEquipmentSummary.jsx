import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { apiRoutes } from '@/constants/routes'
import { LinkRenderer } from '@/utils/grid/cellRenderers'
import Grid2 from '@mui/material/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { finalSupplyEquipmentSummaryColDefs } from '@/views/FinalSupplyEquipments/_schema.jsx'
import GeoMapping from './GeoMapping'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'

export const FinalSupplyEquipmentSummary = ({ data, status }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState('final-supply-equipments-grid')
  const [showMap, setShowMap] = useState(false)
  const { complianceReportId } = useParams()

  const gridRef = useRef()
  const { t } = useTranslation(['common', 'finalSupplyEquipment'])
  const location = useLocation()

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const gridOptions = useMemo(() => ({
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
  }))

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

  const handleGridKey = () => {
    setGridKey(`final-supply-equipments-grid-${uuid()}`)
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
        <BCDataGridServer
          className={'ag-theme-material'}
          gridRef={gridRef}
          apiEndpoint={apiRoutes.getAllFinalSupplyEquipments}
          apiData={'finalSupplyEquipments'}
          apiParams={{ complianceReportId }}
          columnDefs={columns}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          suppressPagination={data.finalSupplyEquipments.length <= 10}
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
