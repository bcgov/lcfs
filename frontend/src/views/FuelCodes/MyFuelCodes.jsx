import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import BCTypography from '@/components/BCTypography'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import { useGetMyFuelCodes } from '@/hooks/useFuelCode'
import withRole from '@/utils/withRole'
import { FuelCodesTabs } from '@/views/CarbonIntensity/components/FuelCodesTabs'
import Grid2 from '@mui/material/Grid2'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { myFuelCodeColDefs, defaultSortModel } from './_schema'

const initialPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultSortModel,
  filters: []
}

const MyFuelCodesBase = () => {
  const gridRef = useRef(null)

  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const { t } = useTranslation(['common', 'fuelCode'])
  const location = useLocation()

  const queryData = useGetMyFuelCodes(paginationOptions, {
    cacheTime: 0,
    staleTime: 0
  })

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  useEffect(() => {
    if (queryData.isError && queryData.error) {
      setAlertMessage(
        queryData.error.message || t('fuelCode:fuelCodeLoadFailMsg')
      )
      setAlertSeverity('error')
    }
  }, [queryData.isError, queryData.error, t])

  const getRowId = (params) => params.data.fuelCodeId.toString()

  return (
    <Grid2 className="fuel-code-container" mx={-1}>
      <FuelCodesTabs />
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCTypography variant="h5" color="primary" data-test="title">
        {t('fuelCode:myFuelCodesTitle')}
      </BCTypography>
      <BCBox component="div" mt={2} sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey="my-fuel-codes-grid"
          columnDefs={myFuelCodeColDefs(t)}
          getRowId={getRowId}
          overlayNoRowsTemplate={t('fuelCode:noFuelCodesFound')}
          queryData={queryData}
          dataKey="fuelCodes"
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({
              ...prev,
              ...newPagination
            }))
          }
        />
      </BCBox>
    </Grid2>
  )
}

export const MyFuelCodes = withRole(
  MyFuelCodesBase,
  [roles.ci_applicant],
  ROUTES.DASHBOARD
)
MyFuelCodes.displayName = 'MyFuelCodes'
