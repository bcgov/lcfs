// Icons
import { faCirclePlus, faFileExcel } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import BCTypography from '@/components/BCTypography'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import { Paper } from '@mui/material'

import OrganizationTable from '@/layouts/organization/components/OrganizationTable'
import { useNavigate, useLocation } from 'react-router-dom'
import * as routes from '@/constants/routes'
import BCAlert from '@/components/BCAlert'

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

export default function OrganizationLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const { message, severity } = location.state || {}

  return (
    <Paper
      elevation={5}
      sx={{
        padding: '1rem',
        position: 'relative',
        minHeight: '80vh',
        bgcolor: 'background.paper'
      }}
    >
      <div>
        {message && <BCAlert data-test="alert-box" severity={severity || 'info'}>{message}</BCAlert>}
      </div>
      <BCTypography variant="h3">Organizations</BCTypography>
      <BCBox
        sx={{
          display: 'flex',
          flexDirection: 'row', // default layout is row
          flexWrap: 'wrap', // allow items to wrap to the next row
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          textTransform: 'none'
        }}
        my={2}
      >
        <BCButton
          variant="contained"
          size="large"
          color="primary"
          sx={{
            textTransform: 'none',
            marginRight: '8px',
            marginBottom: '8px'
          }}
          startIcon={<FontAwesomeIcon icon={faCirclePlus} />}
          onClick={() => navigate(routes.ADD_ORGANIZATION)}
        >
          <BCTypography variant="subtitle2">New Organization</BCTypography>
        </BCButton>
        <BCButton
          variant="outlined"
          size="large"
          color="primary"
          sx={{
            textTransform: 'none',
            marginRight: '8px',
            marginBottom: '8px',
            whiteSpace: 'nowrap'
          }}
          startIcon={<FontAwesomeIcon icon={faFileExcel} />}
          onClick={() => {}}
        >
          <BCTypography variant="subtitle2">
            Download Organization Information
          </BCTypography>
        </BCButton>
        <BCButton
          variant="outlined"
          size="large"
          color="primary"
          sx={{
            textTransform: 'none',
            marginRight: '8px',
            marginBottom: '8px'
          }}
          startIcon={<FontAwesomeIcon icon={faFileExcel} />}
          onClick={() => {}}
        >
          <BCTypography variant="subtitle2">
            Download User Information
          </BCTypography>
        </BCButton>
      </BCBox>
      <BCBox
        component="div"
        className="ag-theme-alpine"
        style={{ height: '100%', width: '100%' }}
      >
        <OrganizationTable rows={demoData} />
      </BCBox>
    </Paper>
  )
}
