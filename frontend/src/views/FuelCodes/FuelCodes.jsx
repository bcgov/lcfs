import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { DownloadButton } from '@/components/DownloadButton'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useGetFuelCodes } from '@/hooks/useFuelCode'
import { useApiService } from '@/services/useApiService'
import withRole from '@/utils/withRole'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { fuelCodeColDefs } from './_schema'

const FuelCodesBase = () => {
  const [isDownloadingFuelCodes, setIsDownloadingFuelCodes] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const { data: currentUser } = useCurrentUser()

  const userRoles = currentUser?.roles?.map((role) => role.name) || []

  const isAuthorized = [
    roles.analyst,
    roles.compliance_manager,
    roles.director
  ].some((role) => userRoles.includes(role))

  const apiService = useApiService()
  const { t } = useTranslation(['common', 'fuelCodes'])
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const getRowId = (params) => {
    return params.data.fuelCodeId.toString()
  }

  const handleRowClicked = (params) => {
    if (!isAuthorized) return
    navigate(
      ROUTES.FUELCODES_VIEW.replace(':fuelCodeID', params.data.fuelCodeId)
    )
  }

  const handleDownloadFuelCodes = async () => {
    setIsDownloadingFuelCodes(true)
    setAlertMessage('')
    try {
      await apiService.download(ROUTES.FUELCODES + '/export')
      setIsDownloadingFuelCodes(false)
    } catch (error) {
      console.error('Error downloading fuel code information:', error)
      setIsDownloadingFuelCodes(false)
      setAlertMessage(t('fuelCode:fuelCodeDownloadFailMsg'))
      setAlertSeverity('error')
    }
  }

  return (
    <Grid2 className="fuel-code-container" mx={-1}>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <Typography variant="h5" color="primary" data-test="title">
        {t('FuelCodes')}
      </Typography>
      <Stack
        direction={{ md: 'coloumn', lg: 'row' }}
        spacing={{ xs: 2, sm: 2, md: 3 }}
        useFlexGap
        flexWrap="wrap"
        mt={1}
        mb={2}
      >
        <Role roles={[roles.administrator]}>
          <BCButton
            variant="contained"
            size="small"
            color="primary"
            startIcon={
              <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
            }
            data-test="new-fuel-code-btn"
            onClick={() => navigate(ROUTES.FUELCODES_ADD)}
          >
            <Typography variant="subtitle2">
              {t('fuelCode:newFuelCodeBtn')}
            </Typography>
          </BCButton>
        </Role>
        <DownloadButton
          onDownload={handleDownloadFuelCodes}
          isDownloading={isDownloadingFuelCodes}
          label={t('fuelCode:fuelCodeDownloadBtn')}
          downloadLabel={`${t('fuelCode:fuelCodeDownloadingMsg')}...`}
          dataTest="fuel-code-download-btn"
        />
      </Stack>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey={'fuel-codes-grid'}
          columnDefs={fuelCodeColDefs(t)}
          query={useGetFuelCodes}
          queryParams={{ cacheTime: 0, staleTime: 0 }}
          dataKey={'fuelCodes'}
          getRowId={getRowId}
          onRowClicked={handleRowClicked}
          overlayNoRowsTemplate={t('fuelCode:noFuelCodesFound')}
          autoSizeStrategy={{
            defaultMinWidth: 50,
            defaultMaxWidth: 600
          }}
        />
      </BCBox>
    </Grid2>
  )
}

export const FuelCodes = withRole(
  FuelCodesBase,
  [roles.analyst],
  ROUTES.DASHBOARD
)
FuelCodes.displayName = 'FuelCodes'
