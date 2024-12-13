import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { apiRoutes, ROUTES } from '@/constants/routes'
import { CommonArrayRenderer } from '@/utils/grid/cellRenderers'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { v4 as uuid } from 'uuid'

export const FinalSupplyEquipmentSummary = ({ data }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`final-supply-equipments-grid`)
  const { complianceReportId, compliancePeriod } = useParams()

  const gridRef = useRef()
  const { t } = useTranslation(['common', 'finalSupplyEquipments'])
  const location = useLocation()
  const navigate = useNavigate()

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
      filter: false
    }),
    []
  )
  const columns = useMemo(
    () => [
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.organizationName'
        ),
        field: 'organizationName'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.supplyFromDate'
        ),
        field: 'supplyFromDate'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.supplyToDate'
        ),
        field: 'supplyToDate'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.kwhUsage'
        ),
        field: 'kwhUsage',
        valueFormatter: (params) =>
          params.value ? params.value.toFixed(2) : '0.00'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.registrationNbr'
        ),
        field: 'registrationNbr'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.serialNbr'
        ),
        field: 'serialNbr'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.manufacturer'
        ),
        field: 'manufacturer'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.model'
        ),
        field: 'model'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.levelOfEquipment'
        ),
        field: 'levelOfEquipment',
        valueGetter: (params) => params.data.levelOfEquipment.name
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.ports'
        ),
        field: 'ports'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.fuelMeasurementType'
        ),
        field: 'fuelMeasurementType',
        valueGetter: (params) => params.data.fuelMeasurementType.type
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.intendedUses'
        ),
        field: 'intendedUses',
        valueGetter: (params) =>
          params.data.intendedUseTypes.map((use) => use.type).join(', '),
        cellRenderer: CommonArrayRenderer,
        cellRendererParams: { marginTop: '0.7em' }
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.intendedUsers'
        ),
        field: 'intendedUsers',
        valueGetter: (params) =>
          params.data.intendedUserTypes.map((use) => use.typeName).join(', '),
        cellRenderer: CommonArrayRenderer,
        cellRendererParams: { marginTop: '0.7em' }
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.streetAddress'
        ),
        field: 'streetAddress'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.city'
        ),
        field: 'city'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.postalCode'
        ),
        field: 'postalCode'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.latitude'
        ),
        field: 'latitude'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.longitude'
        ),
        field: 'longitude'
      },
      {
        headerName: t(
          'finalSupplyEquipment:finalSupplyEquipmentColLabels.notes'
        ),
        field: 'notes'
      }
    ],
    [t]
  )

  const getRowId = (params) => {
    return params.data.finalSupplyEquipmentId.toString()
  }

  const handleGridKey = () => {
    setGridKey(`final-supply-equipments-grid-${uuid()}`)
  }

  const handleRowClicked = (params) => {
    navigate(
      ROUTES.REPORTS_ADD_FINAL_SUPPLY_EQUIPMENTS.replace(
        ':compliancePeriod',
        compliancePeriod
      ).replace(':complianceReportId', complianceReportId)
    )
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
          handleRowClicked={handleRowClicked}
        />
      </BCBox>
    </Grid2>
  )
}

FinalSupplyEquipmentSummary.displayName = 'FinalSupplyEquipmentSummary'
