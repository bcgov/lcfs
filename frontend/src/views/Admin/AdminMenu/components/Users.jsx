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
import { apiRoutes, ROUTES } from '@/constants/routes'
import { idirUserDefaultFilter, usersColumnDefs } from './_schema'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'

export const Users = () => {
  const { t } = useTranslation(['common', 'admin'])
  const location = useLocation()
  const [gridKey, setGridKey] = useState('users-grid')
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [resetGridFn, setResetGridFn] = useState(null)

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
      <BCBox component="div">
        <BCTypography variant="h5" my={1} color="primary">
          {t('admin:Users')}
        </BCTypography>
        <BCBox
          display="flex"
          alignItems="center"
          gap={2}
          mt={1}
        >
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
          <ClearFiltersButton
            onClick={handleClearFilters}
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
            defaultFilterModel={idirUserDefaultFilter}
            handleGridKey={handleGridKey}
            enableResetButton={false}
            enableCopyButton={false}
            defaultColDef={defaultColDef}
            onSetResetGrid={(fn) => {
              setResetGridFn(() => fn) // Preserves function reference
            }}
          />
        </BCBox>
      </BCBox>
    </>
  )
}

Users.propTypes = {}
