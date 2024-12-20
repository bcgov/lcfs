import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { useGetFuelExports } from '@/hooks/useFuelExport'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import i18n from '@/i18n'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses.js'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'

export const FuelExportSummary = ({ data, status }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
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
      minWidth: 200,
      floatingFilter: false,
      filter: false,
      cellRenderer:
        status === COMPLIANCE_REPORT_STATUSES.DRAFT ? LinkRenderer : undefined,
      cellRendererParams: {
        url: () => {
          return 'fuel-exports'
        }
      }
    }),
    [status]
  )

  const columns = useMemo(
    () => [
      {
        headerName: t('fuelExport:fuelExportColLabels.complianceUnits'),
        field: 'complianceUnits',
        valueFormatter
      },
      {
        headerName: t('fuelExport:fuelExportColLabels.exportDate'),
        field: 'exportDate'
      },
      {
        headerName: t('fuelExport:fuelExportColLabels.fuelType'),
        field: 'fuelType',
        valueGetter: (params) => params.data.fuelType?.fuelType
      },
      {
        headerName: t('fuelExport:fuelExportColLabels.fuelCategory'),
        field: 'fuelCategory',
        valueGetter: (params) => params.data.fuelCategory?.category
      },
      {
        headerName: t('fuelExport:fuelExportColLabels.endUse'),
        field: 'endUse',
        valueGetter: (params) => params.data.endUseType?.type || 'Any'
      },
      {
        headerName: t(
          'fuelExport:fuelExportColLabels.determiningCarbonIntensity'
        ),
        field: 'determiningCarbonIntensity',
        valueGetter: (params) => params.data.provisionOfTheAct?.name
      },
      {
        headerName: t('fuelExport:fuelExportColLabels.fuelCode'),
        field: 'fuelCode',
        valueGetter: (params) => params.data.fuelCode?.fuelCode
      },
      {
        headerName: t('fuelExport:fuelExportColLabels.quantity'),
        field: 'quantity',
        valueFormatter
      },
      { headerName: t('fuelExport:fuelExportColLabels.units'), field: 'units' },
      {
        headerName: t('fuelExport:fuelExportColLabels.targetCI'),
        field: 'targetCi'
      },
      {
        headerName: t('fuelExport:fuelExportColLabels.ciOfFuel'),
        field: 'ciOfFuel'
      },
      {
        field: 'uci',
        headerName: i18n.t('fuelExport:fuelExportColLabels.uci')
      },
      {
        headerName: t('fuelExport:fuelExportColLabels.energyDensity'),
        field: 'energyDensity'
      },
      { headerName: t('fuelExport:fuelExportColLabels.eer'), field: 'eer' },
      {
        headerName: t('fuelExport:fuelExportColLabels.energy'),
        field: 'energy',
        valueFormatter
      }
    ],
    [t]
  )

  const getRowId = (params) => {
    return params.data.fuelExportId.toString()
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
        <BCGridViewer
          gridKey="fuel-exports"
          gridRef={gridRef}
          query={useGetFuelExports}
          dataKey="fuelExports"
          queryParams={{ complianceReportId }}
          columnDefs={columns}
          getRowId={getRowId}
          gridOptions={gridOptions}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          suppressPagination={data.fuelExports.length <= 10}
        />
      </BCBox>
    </Grid2>
  )
}

FuelExportSummary.displayName = 'FuelExportSummary'
