import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { useGetOtherUses } from '@/hooks/useOtherUses'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters'

export const OtherUsesSummary = ({ data }) => {
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const { complianceReportId } = useParams()

  const location = useLocation()

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const columns = [
    {
      headerName: 'Fuel Type',
      field: 'fuelType',
      floatingFilter: false,
      width: '260px'
    },
    {
      headerName: 'Fuel Category',
      field: 'fuelCategory',
      floatingFilter: false
    },
    {
      headerName: 'Quantity Supplied',
      field: 'quantitySupplied',
      floatingFilter: false,
      valueFormatter
    },
    { headerName: 'Units', field: 'units', floatingFilter: false },
    { headerName: 'Expected Use', field: 'expectedUse', floatingFilter: false },
    { headerName: 'Rationale', field: 'rationale', floatingFilter: false }
  ]

  const getRowId = (params) => params.data.otherUsesId

  return (
    <Grid2 className="other-uses-container" data-test="container" mx={-1}>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCBox component="div" sx={{ height: '100%', width: '75rem' }}>
        <BCGridViewer
          gridKey={'other-uses'}
          getRowId={getRowId}
          columnDefs={columns}
          query={useGetOtherUses}
          queryParams={{ complianceReportId }}
          dataKey={'otherUses'}
          suppressPagination={data?.length <= 10}
          autoSizeStrategy={{
            type: 'fitCellContents',
            defaultMinWidth: 50,
            defaultMaxWidth: 600
          }}
          enableCellTextSelection
          ensureDomOrder
        />
      </BCBox>
    </Grid2>
  )
}

OtherUsesSummary.displayName = 'OtherUsesSummary'
