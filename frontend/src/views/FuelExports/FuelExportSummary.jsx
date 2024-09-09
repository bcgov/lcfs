import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { apiRoutes } from '@/constants/routes'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'

export const FuelExportSummary = ({ data }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`fuel-exports-grid`)
  const { complianceReportId } = useParams()

  const gridRef = useRef()
  const { t } = useTranslation(['common', 'fuelExport'])
  const location = useLocation()

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('fuelExport:noFuelExportsFound'),
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
      filter: false
    }),
    []
  )

  // TODO: The values for the following columns must be determined
  const columns = useMemo(() => ([
    { headerName: t('fuelExport:fuelExportColLabels.complianceUnits'), field: "complianceUnits", valueFormatter },
    { headerName: t('fuelExport:fuelExportColLabels.exportDate'), field: "exportDate" },
    { headerName: t('fuelExport:fuelExportColLabels.fuelType'), field: "fuelType", valueGetter: (params) => params.data.fuelType?.fuelType },
    { headerName: t('fuelExport:fuelExportColLabels.fuelCategory'), field: "fuelCategory", valueGetter: (params) => params.data.fuelCategory?.category },
    { headerName: t('fuelExport:fuelExportColLabels.endUse'), field: "endUse", valueGetter: (params) => params.data.endUseType?.type || 'Any' },
    { headerName: t('fuelExport:fuelExportColLabels.determiningCarbonIntensity'), field: "determiningCarbonIntensity", valueGetter: params => params.data.provisionOfTheAct?.name },
    { headerName: t('fuelExport:fuelExportColLabels.fuelCode'), field: "fuelCode", valueGetter: (params) => params.data.fuelCode?.fuelCode },
    { headerName: t('fuelExport:fuelExportColLabels.quantity'), field: "quantity", valueFormatter },
    { headerName: t('fuelExport:fuelExportColLabels.units'), field: "units" },
    { headerName: t('fuelExport:fuelExportColLabels.ciLimit'), field: "ciLimit" },
    { headerName: t('fuelExport:fuelExportColLabels.ciOfFuel'), field: "ciOfFuel" },
    { headerName: t('fuelExport:fuelExportColLabels.energyDensity'), field: "energyDensity" },
    { headerName: t('fuelExport:fuelExportColLabels.eer'), field: "eer" },
    { headerName: t('fuelExport:fuelExportColLabels.energy'), field: "energy", valueFormatter },
  ]), [t])

  const getRowId = (params) => {
    return params.data.fuelExportId
  }

  const handleGridKey = () => {
    setGridKey(`fuel-exports-grid-${uuid()}`)
  }

  return (
    <Grid2 className="fuel-export-container" mx={-1}>
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
          apiEndpoint={apiRoutes.getAllFuelExports}
          apiData={'fuelExports'}
          apiParams={{ complianceReportId }}
          columnDefs={columns}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          suppressPagination={data.fuelExports.length <= 10}
        />
      </BCBox>
    </Grid2>
  )
}

FuelExportSummary.displayName = 'FuelExportSummary'
