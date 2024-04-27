// mui components
import BCButton from '@/components/BCButton'
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { Role } from '@/components/Role'
// Icons
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// react components
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
// Services
import { DownloadButton } from '@/components/DownloadButton'
import { useApiService } from '@/services/useApiService'
// import { v4 as uuid } from 'uuid'
import { fuelCodeColDefs } from './_schema'
import withRole from '@/utils/withRole'
// Constants
import { ROUTES } from '@/constants/routes'
import { roles } from '@/constants/roles'

export const FuelCodes = () => {
  const [isDownloadingFuelCodes, setIsDownloadingFuelCodes] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`fuel-codes-grid`)

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

  const getRowId = useCallback((params) => {
    return params.data.fuelCodeId
  }, [])

  const handleGridKey = useCallback(() => {
    // setGridKey(`fuel-codes-grid-${uuid()}`)
    setGridKey(`fuel-codes-grid-<unique-id>`)
  }, [])

  const handleRowClicked = useCallback((params) => {
    navigate(
      ROUTES.ADMIN_FUEL_CODES_VIEW.replace(
        ':fuelCodeID',
        params.data.fuelCodeId
      )
    )
  })

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
          apiEndpoint={'fuelCodes/'}
          apiData={'fuelCodes'}
          columnDefs={fuelCodeColDefs(t)}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          handleRowClicked={handleRowClicked}
          enableCopyButton={false}
        />
      </BCBox>
    </Grid2>
  )
}

const AllowedRoles = [roles.administrator, roles.government]
export const FuelCodesWithRole = withRole(FuelCodes, AllowedRoles)
FuelCodes.displayName = 'FuelCodes'
