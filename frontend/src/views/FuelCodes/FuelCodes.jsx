import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import BCTypography from '@/components/BCTypography'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { DownloadButton } from '@/components/DownloadButton'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import { useGetFuelCodes, useDownloadFuelCodes } from '@/hooks/useFuelCode'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import withRole from '@/utils/withRole'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Stack } from '@mui/material'
import Grid2 from '@mui/material/Grid2'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { fuelCodeColDefs, defaultSortModel } from './_schema'
import { defaultInitialPagination } from '@/constants/schedules.js'

const convertToBackendFilters = (model = {}) =>
  Object.entries(model).map(([field, cfg]) => ({
    field,
    filterType: cfg.filterType || 'text',
    type: cfg.type,
    filter: cfg.filter,
    dateFrom: cfg.dateFrom,
    dateTo: cfg.dateTo
  }))

const initialPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultSortModel,
  filters: []
}

const FuelCodesBase = () => {
  const gridRef = useRef(null)

  const [isDownloading, setIsDownloading] = useState(false)

  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const downloadButtonRef = useRef(null)

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const { t } = useTranslation(['common', 'fuelCodes'])
  const navigate = useNavigate()
  const location = useLocation()

  const queryData = useGetFuelCodes(paginationOptions, {
    cacheTime: 0,
    staleTime: 0
  })
  const { mutateAsync: downloadFuelCodes } = useDownloadFuelCodes()

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

  const buildExportPayload = () => ({
    page: 1,
    size: 10000, // ignored by backend, but required by schema
    filters: convertToBackendFilters(
      gridRef.current?.api?.getFilterModel?.() || {}
    ),
    sortOrders: paginationOptions.sortOrders || []
  })

  const handleDownload = async () => {
    setIsDownloading(true)
    setAlertMessage('')
    try {
      await downloadFuelCodes({ format: 'xlsx', body: buildExportPayload() })
      setIsDownloading(false)
    } catch (error) {
      console.error('Error downloading fuel code information:', error)
      setIsDownloading(false)
      setAlertMessage(t('fuelCode:fuelCodeDownloadFailMsg'))
      setAlertSeverity('error')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleClearFilters = () => {
    setPaginationOptions(initialPaginationOptions)
    if (gridRef && gridRef.current) {
      gridRef.current.clearFilters()
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
      <BCTypography variant="h5" color="primary" data-test="title">
        {t('FuelCodes')}
      </BCTypography>
      <Stack
        direction={{ md: 'column', lg: 'row' }}
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
            onClick={() => navigate(ROUTES.FUEL_CODES.ADD)}
          >
            <BCTypography variant="subtitle2">
              {t('fuelCode:newFuelCodeBtn')}
            </BCTypography>
          </BCButton>
        </Role>
        <DownloadButton
          ref={downloadButtonRef}
          onDownload={handleDownload}
          isDownloading={isDownloading}
          label={t('fuelCode:fuelCodeDownloadBtn')}
          downloadLabel={`${t('fuelCode:fuelCodeDownloadingMsg')}...`}
          dataTest="fuel-code-download-btn"
        />
        <ClearFiltersButton
          onClick={handleClearFilters}
          sx={{
            minWidth: 'fit-content',
            whiteSpace: 'nowrap'
          }}
        />
      </Stack>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey="fuel-codes-grid"
          columnDefs={fuelCodeColDefs(t)}
          getRowId={getRowId}
          overlayNoRowsTemplate={t('fuelCode:noFuelCodesFound')}
          defaultColDef={defaultColDef}
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

export const FuelCodes = withRole(
  FuelCodesBase,
  [roles.government],
  ROUTES.DASHBOARD
)
FuelCodes.displayName = 'FuelCodes'
