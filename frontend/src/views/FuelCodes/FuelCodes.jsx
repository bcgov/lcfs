import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { DownloadButton } from '@/components/DownloadButton'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useGetFuelCodes } from '@/hooks/useFuelCode'
import { useApiService } from '@/services/useApiService'
import withRole from '@/utils/withRole'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Stack } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { fuelCodeColDefs } from './_schema'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'

const FuelCodesBase = () => {
  const [isDownloadingFuelCodes, setIsDownloadingFuelCodes] = useState(false)
  const [resetGridFn, setResetGridFn] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const downloadButtonRef = useRef(null);

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

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        url: (data) => data.data.fuelCodeId
      }
    }),
    []
  )

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

  const handleSetResetGrid = useCallback((fn) => {
    setResetGridFn(() => fn)
  }, [])

  const handleClearFilters = useCallback(() => {
    if (resetGridFn) {
      resetGridFn()
    }
  }, [resetGridFn])

  return (
    <Grid2 className="fuel-code-container" mx={-1}>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCTypography variant="h5" color="primary" data-test="title">
        {t('FuelCodes')}
      </BCTypography>
      <Stack
        direction={{ md: 'coloumn', lg: 'row' }}
        spacing={{ xs: 2, sm: 2, md: 3 }}
        useFlexGap
        flexWrap="wrap"
        mt={1}
        mb={2}
      >
        <Role roles={[roles.analyst]}>
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
            <BCTypography variant="subtitle2">
              {t('fuelCode:newFuelCodeBtn')}
            </BCTypography>
          </BCButton>
        </Role>
        <DownloadButton
          ref={downloadButtonRef}
          onDownload={handleDownloadFuelCodes}
          isDownloading={isDownloadingFuelCodes}
          label={t('fuelCode:fuelCodeDownloadBtn')}
          downloadLabel={`${t('fuelCode:fuelCodeDownloadingMsg')}...`}
          dataTest="fuel-code-download-btn"
        />
        <ClearFiltersButton
          onClick={handleClearFilters}
          sx={{
            height: downloadButtonRef.current?.offsetHeight || '36px',
            minWidth: 'fit-content',
            whiteSpace: 'nowrap'
          }}
        />
      </Stack>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey={'fuel-codes-grid'}
          columnDefs={fuelCodeColDefs(t)}
          query={useGetFuelCodes}
          queryParams={{ cacheTime: 0, staleTime: 0 }}
          dataKey="fuelCodes"
          getRowId={getRowId}
          overlayNoRowsTemplate={t('fuelCode:noFuelCodesFound')}
          defaultColDef={defaultColDef}
          defaultFilterModel={location.state?.filters}
          onSetResetGrid={handleSetResetGrid}
        />
      </BCBox>
    </Grid2>
  )
}

export const FuelCodes = withRole(
  FuelCodesBase,
  [roles.government],
  ROUTES.DASHBOARD
)
FuelCodes.displayName = 'FuelCodes'
