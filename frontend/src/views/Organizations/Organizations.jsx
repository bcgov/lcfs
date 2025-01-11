import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { Stack } from '@mui/material'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { organizationsColDefs } from './ViewOrganization/_schema'
import { apiRoutes, ROUTES } from '@/constants/routes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DownloadButton } from '@/components/DownloadButton'
import { useApiService } from '@/services/useApiService'
import { roles } from '@/constants/roles'
import { Role } from '@/components/Role'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'

export const Organizations = () => {
  const { t } = useTranslation(['common', 'org'])
  const gridRef = useRef()
  const downloadButtonRef = useRef(null);
  const [gridKey, setGridKey] = useState(`organizations-grid`)
  const handleGridKey = useCallback(() => {
    setGridKey('organizations-grid')
  }, [])
  const gridOptions = {
    overlayNoRowsTemplate: t('org:noOrgsFound')
  }
  const getRowId = useCallback((params) => {
    return params.data.organizationId
  }, [])

  const navigate = useNavigate()
  const location = useLocation()

  const defaultSortModel = [{ field: 'name', direction: 'asc' }]

  const apiService = useApiService()
  const [isDownloadingOrgs, setIsDownloadingOrgs] = useState(false)
  const [isDownloadingUsers, setIsDownloadingUsers] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [resetGridFn, setResetGridFn] = useState(null)

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const handleDownloadOrgs = async () => {
    setIsDownloadingOrgs(true)
    setAlertMessage('')
    try {
      await apiService.download('/organizations/export')
      setIsDownloadingOrgs(false)
    } catch (error) {
      console.error('Error downloading organization information:', error)
      setIsDownloadingOrgs(false)
      setAlertMessage(t('org:orgDownloadFailMsg'))
      setAlertSeverity('error')
    }
  }

  const handleDownloadUsers = async () => {
    setIsDownloadingUsers(true)
    try {
      await apiService.download(apiRoutes.exportUsers)
      setIsDownloadingUsers(false)
    } catch (error) {
      console.error('Error downloading user information:', error)
      setIsDownloadingUsers(false)
      setAlertMessage(t('org:userDownloadFailMsg'))
      setAlertSeverity('error')
    }
  }

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        url: (data) => data.data.organizationId
      }
    }),
    []
  )

  const handleSetResetGrid = useCallback((fn) => {
    setResetGridFn(() => fn)
  }, [])

  const handleClearFilters = useCallback(() => {
    if (resetGridFn) {
      resetGridFn()
    }
  }, [resetGridFn])

  return (
    <>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCTypography variant="h5" color="primary">
        {t('org:title')}
      </BCTypography>
      <Stack
        direction={{ md: 'coloumn', lg: 'row' }}
        spacing={{ xs: 2, sm: 2, md: 3 }}
        useFlexGap
        flexWrap="wrap"
        m={2}
      >
        <Role roles={[roles.administrator]}>
          <BCButton
            variant="contained"
            size="small"
            color="primary"
            startIcon={
              <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
            }
            onClick={() => navigate(ROUTES.ORGANIZATIONS_ADD)}
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
            height: downloadButtonRef.current?.offsetHeight || '36px',
            minWidth: 'fit-content',
            whiteSpace: 'nowrap'
          }}
        />
      </Stack>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCDataGridServer
          gridRef={gridRef}
          apiEndpoint="organizations/"
          apiData="organizations"
          columnDefs={organizationsColDefs(t)}
          gridKey={gridKey}
          getRowId={getRowId}
          defaultSortModel={defaultSortModel}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          onSetResetGrid={handleSetResetGrid}
        />
      </BCBox>
    </>
  )
}
