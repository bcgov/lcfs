// mui components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { Stack } from '@mui/material'
// Icons
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// Internal components
import { organizationsColDefs } from './ViewOrganization/_schema'
// react components
import { ROUTES, apiRoutes } from '@/constants/routes'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
// Services
import { DownloadButton } from '@/components/DownloadButton'
import { useApiService } from '@/services/useApiService'

export const Organizations = () => {
  const { t } = useTranslation(['common', 'org'])
  const gridRef = useRef()
  const [gridKey, setGridKey] = useState(`organizations-grid`)
  const handleGridKey = useCallback(() => {
    setGridKey(`organizations-grid`)
  }, [])
  const gridOptions = {
    overlayNoRowsTemplate: t('org:noOrgsFound')
  }
  const getRowId = useCallback((params) => {
    return params.data.name
  }, [])

  const navigate = useNavigate()
  const location = useLocation()

  const defaultSortModel = [{ field: 'name', direction: 'asc' }]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRowClicked = useCallback((params) => {
    navigate(
      ROUTES.ORGANIZATIONS_VIEW.replace(':orgID', params.data.organization_id)
    )
  })
  const apiService = useApiService()
  const [isDownloadingOrgs, setIsDownloadingOrgs] = useState(false)
  const [isDownloadingUsers, setIsDownloadingUsers] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

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
        <BCButton
          variant="contained"
          size="small"
          color="primary"
          startIcon={
            <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
          }
          onClick={() => navigate(ROUTES.ORGANIZATIONS_ADD)}
        >
          <BCTypography variant="subtitle2">{t('org:newOrgBtn')}</BCTypography>
        </BCButton>
        <DownloadButton
          onDownload={handleDownloadOrgs}
          isDownloading={isDownloadingOrgs}
          label={t('org:orgDownloadBtn')}
          downloadLabel={`${t('org:orgDownloadBtn')}...`}
          dataTest="download-org-button"
        />
        <DownloadButton
          onDownload={handleDownloadUsers}
          isDownloading={isDownloadingUsers}
          label={t('org:userDownloadBtn')}
          downloadLabel={`${t('org:userDownloadBtn')}...`}
          dataTest="download-user-button"
        />
      </Stack>
      <BCBox component="div" sx={{ height: '36rem', width: '100%' }}>
        <BCDataGridServer
          gridRef={gridRef}
          apiEndpoint={'organizations/'}
          apiData={'organizations'}
          columnDefs={organizationsColDefs(t)}
          gridKey={gridKey}
          getRowId={getRowId}
          defaultSortModel={defaultSortModel}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          handleRowClicked={handleRowClicked}
          enableCopyButton={false}
        />
      </BCBox>
    </>
  )
}
