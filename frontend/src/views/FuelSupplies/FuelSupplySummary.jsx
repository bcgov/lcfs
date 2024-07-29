import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { apiRoutes } from '@/constants/routes'
import { CommonArrayRenderer } from '@/utils/cellRenderers'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'

export const FuelSupplySummary = ({ data }) => {

  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`fuel-supplies-grid`)
  const { complianceReportId } = useParams()


  const gridRef = useRef()
  const { t } = useTranslation(['common', 'fuelSupply'])
  const location = useLocation()

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const gridOptions = useMemo(() => ({
    overlayNoRowsTemplate: t('fuelSupply:noFuelSuppliesFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    },
    enableCellTextSelection: true, // enables text selection on the grid
    ensureDomOrder: true,
  }))

  const defaultColDef = useMemo(
    () => ({
      floatingFilter: false,
      filter: false,
    }),
    []
  )

  // TODO: The values for the following columns must be determined
  const columns = useMemo(() => ([
    { headerName: t('fuelSupply:fuelSupplyColLabels.fuelType'), field: "fuelType", valueGetter: (params) => params.data.endUseType.type },
    { headerName: t('fuelSupply:fuelSupplyColLabels.fuelCategory'), field: "fuelCategory", valueGetter: (params) => params.data.fuelCategory.category },
    { headerName: t('fuelSupply:fuelSupplyColLabels.endUse'), field: "endUse", valueGetter: (params) => params.data.endUseType.type },
    { headerName: t('fuelSupply:fuelSupplyColLabels.determiningCarbonIntensity'), field: "determiningCarbonIntensity", valueGetter: '' },
    { headerName: t('fuelSupply:fuelSupplyColLabels.fuelCode'), field: "fuelCode", valueGetter: (params) => params.data.fuelCode.fuelCode },
    { headerName: t('fuelSupply:fuelSupplyColLabels.quantitySupplied'), field: "quantity" },
    { headerName: t('fuelSupply:fuelSupplyColLabels.units'), field: "units", valueGetter: '' },
    { headerName: t('fuelSupply:fuelSupplyColLabels.complianceUnits'), field: "complianceUnits" },
    { headerName: t('fuelSupply:fuelSupplyColLabels.ciLimit'), field: "ciLimit", valueGetter: '' },
    { headerName: t('fuelSupply:fuelSupplyColLabels.ciOfFuel'), field: "ciOfFuel", valueGetter: (params) => params.data.fuelCode.carbonIntensity },
    { headerName: t('fuelSupply:fuelSupplyColLabels.energyDensity'), field: "energyDensity", valueGetter: '' },
    { headerName: t('fuelSupply:fuelSupplyColLabels.eer'), field: "eer", valueGetter: '' },
    { headerName: t('fuelSupply:fuelSupplyColLabels.energy'), field: "energy" },
  ]), [t])

  const getRowId = (params) => {
    return params.data.fuelSupplyId
  }

  const handleGridKey = () => {
    setGridKey(`fuel-supplies-grid-${uuid()}`)
  }

  return (
    <Grid2 className="fuel-supply-container" mx={-1}>
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
          apiEndpoint={apiRoutes.getAllFuelSupplies}
          apiData={'fuelSupplies'}
          apiParams={{complianceReportId}}
          columnDefs={columns}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          suppressPagination={data.fuelSupplies.length <= 10}
        />
      </BCBox>
    </Grid2>
  )
}

FuelSupplySummary.displayName = 'FuelSupplySummary'
