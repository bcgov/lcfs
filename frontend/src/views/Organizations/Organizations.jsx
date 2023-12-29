// mui components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { Stack, CircularProgress } from '@mui/material'
// Icons
import { faCirclePlus, faFileExcel } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// Internal components
import { coloumnDefinition, defaultColumnOptions } from './components/columnDef'
// react components
import { useState, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
// Services
import { useApiService } from '@/services/useApiService'

const DownloadButton = ({
  onDownload,
  isDownloading,
  label,
  downloadLabel,
  dataTest
}) => (
  <BCButton
    data-test={dataTest}
    variant="outlined"
    size="small"
    color="primary"
    sx={{ whiteSpace: 'nowrap' }}
    startIcon={
      isDownloading ? (
        <CircularProgress size={24} />
      ) : (
        <FontAwesomeIcon icon={faFileExcel} className="small-icon" />
      )
    }
    onClick={onDownload}
    disabled={isDownloading}
  >
    <BCTypography variant="subtitle2">
      {isDownloading ? downloadLabel : label}
    </BCTypography>
  </BCButton>
)

export const Organizations = () => {
  const gridRef = useRef()
  const [gridKey, setGridKey] = useState(`organizations-grid-${Math.random()}`)
  const handleGridKey = useCallback(() => {
    setGridKey(`users-grid-${Math.random()}`)
  }, [])
  const gridOptions = {
    overlayNoRowsTemplate: 'No users found'
  }
  const getRowId = useCallback((params) => {
    return params.data.organization_id
  }, [])

  const navigate = useNavigate()
  const location = useLocation()
  const apiService = useApiService()
  const { message, severity } = location.state || {}
  const [isDownloadingOrgs, setIsDownloadingOrgs] = useState(false)

  const handleDownloadOrgs = async () => {
    setIsDownloadingOrgs(true)
    try {
      await apiService.download('/organizations/export/')
      setIsDownloadingOrgs(false)
    } catch (error) {
      console.error('Error downloading organization information:', error)
      setIsDownloadingOrgs(false)
    }
  }

  return (
    <>
      <div>
        {message && (
          <BCAlert data-test="alert-box" severity={severity || 'info'}>
            {message}
          </BCAlert>
        )}
      </div>
      <BCTypography variant="h5">Organizations</BCTypography>
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
          <BCTypography variant="subtitle2">New Organization</BCTypography>
        </BCButton>
        <DownloadButton
          onDownload={handleDownloadOrgs}
          isDownloading={isDownloadingOrgs}
          label="Download Organization Information"
          downloadLabel="Downloading Organization Information..."
          dataTest="download-org-button"
        />
        <BCButton
          variant="outlined"
          size="small"
          color="primary"
          sx={{ whiteSpace: 'nowrap' }}
          startIcon={
            <FontAwesomeIcon icon={faFileExcel} className="small-icon" />
          }
          onClick={() => {}}
        >
          <BCTypography variant="subtitle2">
            Download User Information
          </BCTypography>
        </BCButton>
      </Stack>
      <BCBox
        component="div"
        className="ag-theme-alpine"
        style={{ height: '100%', width: '100%' }}
      >
        {/* <OrganizationTable rows={demoData} /> */}
        <BCDataGridServer
          gridRef={gridRef}
          apiEndpoint={'organizations/list'}
          defaultColDef={defaultColumnOptions}
          columnDefs={coloumnDefinition}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
        />
      </BCBox>
    </>
  )
}
