// mui components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { Stack } from '@mui/material'
// Icons
import { faCirclePlus, faFileExcel } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// Internal components
import { organizationsColDefs } from './components/schema'
// react components
import { useState, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'

export const Organizations = () => {
  const gridRef = useRef()
  const [gridKey, setGridKey] = useState(`organizations-grid-${Math.random()}`)
  const handleGridKey = useCallback(() => {
    setGridKey(`users-grid-${Math.random()}`)
  }, [])
  const gridOptions = {
    overlayNoRowsTemplate: 'No organizations found'
  }
  const getRowId = useCallback((params) => {
    return params.data.organization_id
  }, [])

  const defaultSortModel = [{ field: 'name', direction: 'asc' }]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRowClicked = useCallback((params) => {
    console.log(params.data)
  })

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
          onClick={() => navigate(ROUTES.ORGANIZATIONS_ADD)}
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
        {/* <OrganizationTable rows={demoData} /> */}
        <BCDataGridServer
          gridRef={gridRef}
          apiEndpoint={'organizations/list'}
          apiData={'organizations'}
          columnDefs={organizationsColDefs}
          gridKey={gridKey}
          getRowId={getRowId}
          defaultSortModel={defaultSortModel}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          handleRowClicked={handleRowClicked}
        />
      </BCBox>
    </>
  )
}
