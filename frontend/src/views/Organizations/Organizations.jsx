import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Material UI
import { Stack, CircularProgress } from '@mui/material'

// FontAwesome Icons
import { faCirclePlus, faFileExcel } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

// Services
import { useApiService } from '@/services/useApiService'

// Components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import OrganizationTable from './components/OrganizationTable'

// Constants
import { ROUTES } from '@/constants/routes'

// Data for demo purposes only. Do not use in production.
const demoData = [
  {
    organizationName: 'TFRS Biz Test',
    complianceUnits: 10000,
    reserve: 800,
    registered: true
  },
  {
    organizationName: 'Fuel Supplier Canada Ltd.',
    complianceUnits: 100800,
    reserve: 1100,
    registered: true
  },
  {
    organizationName: 'Strata Vis 555',
    complianceUnits: 17,
    reserve: 0,
    registered: false
  },
  {
    organizationName: 'School District 99',
    complianceUnits: 100,
    reserve: 50,
    registered: true
  }
]

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
  const [isDownloadingOrgs, setIsDownloadingOrgs] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const apiService = useApiService()
  const { message, severity } = location.state || {}

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
        <OrganizationTable rows={demoData} />
      </BCBox>
    </>
  )
}
