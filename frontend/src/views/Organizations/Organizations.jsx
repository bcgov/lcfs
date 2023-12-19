// Icons
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { appRoutes } from '@/constants/routes'
import { faCirclePlus, faFileExcel } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Stack } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import OrganizationTable from './components/OrganizationTable'

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

export const Organizations = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { message, severity } = location.state || {}
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
          onClick={() => navigate(appRoutes.organization.create)}
        >
          <BCTypography variant="subtitle2">New Organization</BCTypography>
        </BCButton>
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
            Download Organization Information
          </BCTypography>
        </BCButton>
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
