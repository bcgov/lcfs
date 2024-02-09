/* eslint-disable react-hooks/exhaustive-deps */
// @mui component
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
// icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
// react components
import { useNavigate } from 'react-router-dom'
import { useCallback, useRef, useState } from 'react'

import { ROUTES, apiRoutes } from '@/constants/routes'
import { usersColumnDefs } from './_schema'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
// import DemoButtons from './DemoButtons'

export const Users = (props) => {
  const [gridKey, setGridKey] = useState('users-grid')
  const handleGridKey = useCallback(() => {
    setGridKey(`users-grid-${Math.random()}`)
    if (gridRef.current) {
      gridRef.current.api.deselectAll()
    }
  }, [])
  const gridOptions = {
    overlayNoRowsTemplate: 'No users found'
  }
  const defaultSortModel = [
    { field: 'is_active', direction: 'desc' },
    { field: 'display_name', direction: 'asc' }
  ]
  const navigate = useNavigate()

  const handleNewUserClick = () => {
    navigate(ROUTES.ADMIN_USERS_ADD)
  }
  const getRowId = useCallback((params) => {
    return params.data.user_profile_id
  }, [])

  const handleRowClicked = useCallback((params) => {
    navigate(`${ROUTES.ADMIN_USERS}/${params.data.user_profile_id}`)
  })

  const gridRef = useRef()

  return (
    <BCBox component="div">
      <BCTypography variant="h5" my={1} color="primary">
        Users
      </BCTypography>
      <BCButton
        variant="contained"
        size="small"
        color="primary"
        startIcon={
          <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
        }
        onClick={handleNewUserClick}
      >
        <BCTypography variant="subtitle2">New User</BCTypography>
      </BCButton>
      <BCBox
        my={2}
        component="div"
        className="ag-theme-alpine"
        style={{ height: '100%', width: '100%' }}
      >
        {/* <DemoButtons gridRef={gridRef} handleGridKey={handleGridKey} /> */}
        <BCDataGridServer
          gridRef={gridRef}
          apiEndpoint={apiRoutes.listUsers}
          apiData={'users'}
          columnDefs={usersColumnDefs}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          defaultSortModel={defaultSortModel}
          handleGridKey={handleGridKey}
          handleRowClicked={handleRowClicked}
          enableCopyButton={false}
        />
      </BCBox>
    </BCBox>
  )
}

Users.propTypes = {}
