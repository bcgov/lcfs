import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { Stack } from '@mui/material'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { organizationsColDefs } from './OrganizationView/_schema'
import { apiRoutes } from '@/constants/routes'
import { ROUTES } from '@/routes/routes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DownloadButton } from '@/components/DownloadButton'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { useApiService } from '@/services/useApiService'
import { useOrganizationsList } from '@/hooks/useOrganizations'
import { roles } from '@/constants/roles'
import { Role } from '@/components/Role'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'

export const Organizations = () => {
  const { t } = useTranslation(['common', 'org'])
  const gridRef = useRef()
  const downloadButtonRef = useRef(null)
  const [gridKey] = useState('organizations-grid')

  // Pagination state
  const [paginationOptions, setPaginationOptions] = useState({
    page: 1,
    size: 10,
    sortOrders: [{ field: 'name', direction: 'asc' }],
    filters: []
  })

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('org:noOrgsFound')
    }),
    [t]
  )
  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        url: (data) => data.data.organizationId
      }
    }),
    []
  )

  // For alert messages
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  // For downloads
  const apiService = useApiService()
  const [isDownloadingOrgs, setIsDownloadingOrgs] = useState(false)
  const [isDownloadingUsers, setIsDownloadingUsers] = useState(false)

  // Use the organizations list hook
  const queryData = useOrganizationsList(paginationOptions)

  // Clear filters using gridRef exposed API and reset pagination filters
  const handleClearFilters = useCallback(() => {
    try {
      gridRef.current?.clearFilters?.()
    } catch (e) {
      // no-op
    }
    setPaginationOptions((prev) => ({ ...prev, page: 1, filters: [] }))
  }, [])

  // Router navigation
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (location?.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location?.state])

  // Download handlers
  const handleDownloadOrgs = async () => {
    setIsDownloadingOrgs(true)
    setAlertMessage('')
    try {
      await apiService.download({ url: apiRoutes.organizationExport })
    } catch (error) {
      console.error('Error downloading organization information:', error)
      setAlertMessage(t('org:orgDownloadFailMsg'))
      setAlertSeverity('error')
    } finally {
      setIsDownloadingOrgs(false)
    }
  }

  const handleDownloadUsers = async () => {
    setIsDownloadingUsers(true)
    try {
      await apiService.download({ url: apiRoutes.exportUsers })
    } catch (error) {
      console.error('Error downloading user information:', error)
      setAlertMessage(t('org:userDownloadFailMsg'))
      setAlertSeverity('error')
    } finally {
      setIsDownloadingUsers(false)
    }
  }

  // Row ID
  const getRowId = useCallback(
    (params) => String(params.data.organizationId),
    []
  )

  return (
    <BCBox className="organizations-container" aria-label="Organizations">
      {alertMessage && (
        <BCAlert data-test="alert-box" severity={alertSeverity}>
          {alertMessage}
        </BCAlert>
      )}
      <BCTypography variant="h5" color="primary">
        {t('org:title')}
      </BCTypography>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={{ xs: 2, sm: 2, md: 3 }}
        useFlexGap
        flexWrap="wrap"
        my={2}
      >
        <Role roles={[roles.administrator]}>
          <BCButton
            variant="contained"
            size="small"
            color="primary"
            startIcon={
              <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
            }
            onClick={() => navigate(ROUTES.ORGANIZATIONS.ADD)}
          >
            <BCTypography variant="subtitle2">
              {t('org:newOrgBtn')}
            </BCTypography>
          </BCButton>
        </Role>
        <DownloadButton
          onDownload={handleDownloadOrgs}
          isDownloading={isDownloadingOrgs}
          label={t('org:orgDownloadBtn')}
          downloadLabel={`${t('org:orgDownloadBtn')}...`}
          dataTest="download-org-button"
        />
        <DownloadButton
          ref={downloadButtonRef}
          onDownload={handleDownloadUsers}
          isDownloading={isDownloadingUsers}
          label={t('org:userDownloadBtn')}
          downloadLabel={`${t('org:userDownloadBtn')}...`}
          dataTest="download-user-button"
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
          gridKey={gridKey}
          columnDefs={organizationsColDefs(t)}
          queryData={queryData}
          dataKey="organizations"
          autoSizeStrategy={{
            type: 'fitGridWidth',
            defaultMinWidth: 50
          }}
          paginationOptions={paginationOptions}
          onPaginationChange={setPaginationOptions}
          getRowId={getRowId}
          gridOptions={gridOptions}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
        />
      </BCBox>
    </BCBox>
  )
}
