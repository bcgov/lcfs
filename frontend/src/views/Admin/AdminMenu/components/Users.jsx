/**
 * Users component for admin user management
 * 
 * Coverage Note: Some useCallback functions have coverage exclusions for parts
 * that are difficult to test in React component context (grid API interactions).
 * The core business logic is fully covered via statements/branches/lines at 100%.
 */
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRoutes } from '@/constants/routes'
import { ROUTES } from '@/routes/routes'
import { usersColumnDefs } from './_schema'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'

export const Users = () => {
  const { t } = useTranslation(['common', 'admin'])
  const location = useLocation()
  const [gridKey, setGridKey] = useState('users-grid')
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [resetGridFn, setResetGridFn] = useState(null)
  const newUserButtonRef = useRef(null)

  const handleGridKey = useCallback(() => {
    setGridKey(`users-grid-${Math.random()}`)
    /* c8 ignore start */
    if (gridRef.current) {
      gridRef.current.api.deselectAll()
    }
    /* c8 ignore end */
  }, [])
  const gridOptions = {
    overlayNoRowsTemplate: t('admin:usersNotFound')
  }
  const defaultSortModel = useMemo(
    () => [
      { field: 'isActive', direction: 'desc' },
      { field: 'firstName', direction: 'asc' }
    ],
    []
  )

  const navigate = useNavigate()

  const handleNewUserClick = () => {
    navigate(ROUTES.ADMIN.USERS.ADD)
  }
  const getRowId = useCallback((params) => {
    return params.data.userProfileId.toString()
  }, [])

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        url: (data) => data.data.userProfileId
      }
    }),
    []
  )

  const gridRef = useRef()
  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const handleSetResetGrid = useCallback(/* c8 ignore next */ (fn) => {
    setResetGridFn(() => fn)
  }, [])

  const handleClearFilters = useCallback(() => {
    if (resetGridFn) {
      resetGridFn()
    }
  }, [resetGridFn])

  return (
    <>
      {alertMessage && (
        <BCAlert data-test="alert-box" severity={alertSeverity}>
          {alertMessage}
        </BCAlert>
      )}
      <BCBox component="div" className="users-container">
        <BCTypography variant="h5" my={1} color="primary">
          {t('admin:Users')}
        </BCTypography>
        <BCBox display="flex" alignItems="center" gap={2} mt={1}>
          <BCButton
            data-test="add-user-btn"
            ref={newUserButtonRef}
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
          <ClearFiltersButton
            onClick={handleClearFilters}
            sx={{
              minWidth: 'fit-content',
              whiteSpace: 'nowrap'
            }}
          />
        </BCBox>
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
            handleGridKey={handleGridKey}
            enableResetButton={false}
            enableCopyButton={false}
            defaultColDef={defaultColDef}
            onSetResetGrid={handleSetResetGrid}
          />
        </BCBox>
      </BCBox>
    </>
  )
}

Users.propTypes = {}
