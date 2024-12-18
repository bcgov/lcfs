import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { apiRoutes, ROUTES } from '@/constants/routes'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import i18n from '@/i18n'
import { StandardCellWarningAndErrors } from '@/utils/grid/errorRenderers'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'

export const FuelSupplySummary = ({ data, status }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`fuel-supplies-grid`)
  const { complianceReportId, compliancePeriod } = useParams()

  const gridRef = useRef()
  const { t } = useTranslation(['common', 'fuelSupply'])
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('fuelSupply:noFuelSuppliesFound'),
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
  const columns = useMemo(
    () => [
      {
        headerName: t('fuelSupply:fuelSupplyColLabels.complianceUnits'),
        field: 'complianceUnits',
        valueFormatter
      },
      {
        headerName: t('fuelSupply:fuelSupplyColLabels.fuelType'),
        field: 'fuelType',
        valueGetter: (params) => params.data.fuelType?.fuelType
      },
      {
        headerName: t('fuelSupply:fuelSupplyColLabels.fuelCategory'),
        field: 'fuelCategory',
        valueGetter: (params) => params.data.fuelCategory?.category
      },
      {
        headerName: t('fuelSupply:fuelSupplyColLabels.endUse'),
        field: 'endUse',
        valueGetter: (params) => params.data.endUseType?.type || 'Any'
      },
      {
        headerName: t(
          'fuelSupply:fuelSupplyColLabels.determiningCarbonIntensity'
        ),
        field: 'determiningCarbonIntensity',
        valueGetter: (params) => params.data.provisionOfTheAct?.name
      },
      {
        headerName: t('fuelSupply:fuelSupplyColLabels.fuelCode'),
        field: 'fuelCode',
        valueGetter: (params) => params.data.fuelCode?.fuelCode
      },
      {
        headerName: t('fuelSupply:fuelSupplyColLabels.quantity'),
        field: 'quantity',
        valueFormatter
      },
      { headerName: t('fuelSupply:fuelSupplyColLabels.units'), field: 'units' },
      {
        headerName: t('fuelSupply:fuelSupplyColLabels.targetCi'),
        field: 'targetCi'
      },
      {
        headerName: t('fuelSupply:fuelSupplyColLabels.ciOfFuel'),
        field: 'ciOfFuel'
      },
      {
        field: 'uci',
        headerName: i18n.t('fuelSupply:fuelSupplyColLabels.uci')
      },
      {
        headerName: t('fuelSupply:fuelSupplyColLabels.energyDensity'),
        field: 'energyDensity'
      },
      { headerName: t('fuelSupply:fuelSupplyColLabels.eer'), field: 'eer' },
      {
        headerName: t('fuelSupply:fuelSupplyColLabels.energy'),
        field: 'energy',
        valueFormatter
      }
    ],
    [t]
  )

  const getRowId = (params) => {
    return params.data.fuelSupplyId.toString()
  }

  const handleGridKey = () => {
    setGridKey(`fuel-supplies-grid-${uuid()}`)
  }

  const handleRowClicked = () => {
    if (status === COMPLIANCE_REPORT_STATUSES.DRAFT) {
      navigate(
        ROUTES.REPORTS_ADD_SUPPLY_OF_FUEL.replace(
          ':compliancePeriod',
          compliancePeriod
        ).replace(':complianceReportId', complianceReportId)
      )
    }
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
          apiParams={{ complianceReportId }}
          columnDefs={columns}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          suppressPagination={data.fuelSupplies.length <= 10}
          handleRowClicked={handleRowClicked}
        />
      </BCBox>
    </Grid2>
  )
}

FuelSupplySummary.displayName = 'FuelSupplySummary'
