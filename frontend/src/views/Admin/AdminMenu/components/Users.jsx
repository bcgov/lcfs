/* eslint-disable react-hooks/exhaustive-deps */
// @mui component
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
// icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
// hooks
import { useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { ROUTES, apiRoutes } from '@/constants/routes'
import { usersColumnDefs, idirUserDefaultFilter } from './_schema'
import { calculateRowHeight } from '@/utils/formatters'

export const Users = () => {
  const { t } = useTranslation(['common', 'admin'])
  const location = useLocation()
  const [gridKey, setGridKey] = useState('users-grid')
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const handleGridKey = useCallback(() => {
    setGridKey(`users-grid-${Math.random()}`)
    if (gridRef.current) {
      gridRef.current.api.deselectAll()
    }
  }, [])
  const gridOptions = {
    overlayNoRowsTemplate: t('admin:usersNotFound')
  }
  const defaultSortModel = [
    { field: 'isActive', direction: 'desc' },
    { field: 'firstName', direction: 'asc' }
  ]
  const navigate = useNavigate()

  const handleNewUserClick = () => {
    navigate(ROUTES.ADMIN_USERS_ADD)
  }
  const getRowId = useCallback((params) => {
    return params.data.userProfileId
  }, [])

  const handleRowClicked = useCallback((params) => {
    navigate(`${ROUTES.ADMIN_USERS}/${params.data.userProfileId}`)
  })

  const gridRef = useRef()
  const getRowHeight = useCallback((params) => {
    const actualWidth = params.api.getColumn('role').getActualWidth()
    return calculateRowHeight(actualWidth, params.data?.roles)
  }, [])

  const onColumnResized = useCallback((params) => {
    const actualWidth = params.api.getColumn('role').getActualWidth()
    params.api.resetRowHeights()
    params.api.forEachNode((node) => {
      const rowHeight = calculateRowHeight(actualWidth, node.data?.roles)
      node.setRowHeight(rowHeight)
    })
  }, [])
  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  return (
    <>
      {alertMessage && (
        <BCAlert data-test="alert-box" severity={alertSeverity}>
          {alertMessage}
        </BCAlert>
      )}
      <BCBox component="div">
        <BCTypography variant="h5" my={1} color="primary">
          {t('admin:Users')}
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
          <BCTypography variant="subtitle2">
            {t('admin:newUserBtn')}
          </BCTypography>
        </BCButton>
        <BCBox
          my={2}
          component="div"
          className="ag-theme-alpine"
          style={{ height: '100%', width: '100%' }}
        >
          <BCDataGridServer
            gridRef={gridRef}
            apiEndpoint={apiRoutes.listUsers}
            apiData={'users'}
            columnDefs={usersColumnDefs(t)}
            gridKey={gridKey}
            getRowId={getRowId}
            gridOptions={gridOptions}
            defaultSortModel={defaultSortModel}
            defaultFilterModel={idirUserDefaultFilter}
            handleGridKey={handleGridKey}
            handleRowClicked={handleRowClicked}
            enableResetButton={false}
            enableCopyButton={false}
            getRowHeight={getRowHeight}
            onColumnResized={onColumnResized}
          />
        </BCBox>
      </BCBox>
    </>
  )
}

Users.propTypes = {}
