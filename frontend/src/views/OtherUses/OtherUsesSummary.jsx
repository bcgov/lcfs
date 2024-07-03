import { useState, useEffect, useMemo, useRef } from 'react'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useTranslation } from 'react-i18next'
import { apiRoutes } from '@/constants/routes'
import { useLocation, useParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'

export const OtherUsesSummary = ({ data }) => {

  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`other-uses-grid`)

  const { complianceReportId } = useParams()

  const gridRef = useRef()
  const { t } = useTranslation(['common', 'otherUses'])
  const location = useLocation()

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const gridOptions = useMemo(() => ({
    overlayNoRowsTemplate: t('otherUses:noOtherUsesFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    }
  }), [t])

  const columns = [
    { headerName: "Fuel Type", field: "fuelType", floatingFilter: false },
    { headerName: "Fuel Category", field: "fuelCategory", floatingFilter: false },
    { headerName: "Quantity Supplied", field: "quantitySupplied", floatingFilter: false },
    { headerName: "Units", field: "units", floatingFilter: false },
    { headerName: "Expected Use", field: "expectedUse", floatingFilter: false },
    { headerName: "Rationale", field: "rationale", floatingFilter: false },
  ];

  const getRowId = (params) => params.data.otherUsesId
  const handleGridKey = () => setGridKey(`other-uses-grid-${uuid()}`)

  return (
    <Grid2 className="other-uses-container" mx={-1}>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCBox component="div" sx={{ height: '100%', width: '68rem' }}>
        <BCDataGridServer
          className={'ag-theme-material'}
          gridRef={gridRef}
          apiEndpoint={apiRoutes.getOtherUses}
          apiData={'otherUses'}
          apiParams={{complianceReportId}}
          columnDefs={columns}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          enableCopyButton={false}
          suppressPagination={data?.length <= 10}
        />
      </BCBox>
    </Grid2>
  )
}

OtherUsesSummary.displayName = 'OtherUsesSummary'
