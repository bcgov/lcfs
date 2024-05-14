import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { DownloadButton } from '@/components/DownloadButton'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { ROUTES, apiRoutes } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useApiService } from '@/services/useApiService'
import withRole from '@/utils/withRole'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { fuelCodeColDefs } from './_schema'

export const FuelCodes = () => {
  const [isDownloadingFuelCodes, setIsDownloadingFuelCodes] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`fuel-codes-grid`)
  const [searchParams] = useSearchParams()
  const highlightedId = searchParams.get('hid')

  const { data: currentUser } = useCurrentUser()

  const userRoles = currentUser?.roles?.map((role) => role.name) || []

  const isAuthorized = [
    roles.analyst,
    roles.compliance_manager,
    roles.director
  ].some((role) => userRoles.includes(role))

  const gridRef = useRef()
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

  const gridOptions = useMemo(() => ({
    overlayNoRowsTemplate: t('fuelCode:noFuelCodesFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    }
  }))

  const getRowId = (params) => {
    return params.data.fuelCodeId
  }

  const handleGridKey = () => {
    // setGridKey(`fuel-codes-grid-${uuid()}`)
    setGridKey(`fuel-codes-grid-<unique-id>`)
  }

  const handleRowClicked = (params) => {
    if (!isAuthorized) return
    console.log(isAuthorized)
    navigate(
      ROUTES.ADMIN_FUEL_CODES_VIEW.replace(
        ':fuelCodeID',
        params.data.fuelCodeId
      )
    )
  }

  const handleDownloadFuelCodes = async () => {
    setIsDownloadingFuelCodes(true)
    setAlertMessage('')
    try {
      await apiService.download(ROUTES.ADMIN_FUEL_CODES + '/export')
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
            onClick={() => navigate(ROUTES.ADMIN_FUEL_CODES_ADD)}
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
          downloadLabel={`${t('fuelCode:fuelCodeDownloadBtn')}...`}
          data-test="fuel-code-download-btn"
        />
      </Stack>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCDataGridServer
          className={'ag-theme-material'}
          gridRef={gridRef}
          apiEndpoint={apiRoutes.getFuelCodes}
          apiData={'fuelCodes'}
          columnDefs={fuelCodeColDefs(t)}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          handleRowClicked={handleRowClicked}
          enableCopyButton={false}
          highlightedRowId={highlightedId}
        />
      </BCBox>
    </Grid2>
  )
}

const AllowedRoles = [roles.administrator, roles.government]
export const FuelCodesWithRole = withRole(FuelCodes, AllowedRoles)
FuelCodes.displayName = 'FuelCodes'
