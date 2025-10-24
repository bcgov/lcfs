import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { useState, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LinkRenderer } from '@/utils/grid/cellRenderers'
import { defaultSortModel, getUserColumnDefs } from './_schema'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { buildPath, ROUTES } from '@/routes/routes'
import { roles } from '@/constants/roles'
import { apiRoutes } from '@/constants/routes'
import { Role } from '@/components/Role'
import { useOrganizationUsers } from '@/hooks/useOrganizations'

export const OrganizationUsers = () => {
  const { t } = useTranslation(['common', 'org'])
  const location = useLocation()
  const navigate = useNavigate()
  const { orgID } = useParams()
  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles
  } = useCurrentUser()

  const [gridKey, setGridKey] = useState(`users-grid-${orgID}-active`)

  const gridRef = useRef()

  // Pagination state
  const [paginationOptions, setPaginationOptions] = useState({
    page: 1,
    size: 10,
    sortOrders: defaultSortModel,
    filters: []
  })

  const handleGridKey = useCallback(() => {
    setGridKey(`users-grid-${orgID}`)
  }, [orgID])

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('org:noUsersFound'),
      includeHiddenColumnsInQuickFilter: true
    }),
    []
  )

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        isAbsolute: true,
        url: (row) => {
          // For IDIR: /organizations/:orgID/users/:userID
          // For BCeID (supplier role): /organization/users/:userID
          // But typically we do the organizations route with orgID if you have it:
          if (hasRoles(roles.supplier)) {
            return buildPath(ROUTES.ORGANIZATION.VIEW_USER, {
              userID: row.data.userProfileId
            })
          } else {
            return buildPath(ROUTES.ORGANIZATIONS.VIEW_USER, {
              orgID,
              userID: row.data.userProfileId
            })
          }
        }
      }
    }),
    [orgID, hasRoles]
  )

  const getRowId = useCallback((params) => params.data.userProfileId, [])

  const handleClearFilters = useCallback(() => {
    try {
      gridRef.current?.clearFilters?.()
    } catch (e) {
      // no-op
    }
    setPaginationOptions((prev) => ({ ...prev, page: 1, filters: [] }))
  }, [])

  const handleNewUserClick = () => {
    // If you are IDIR: navigate to /organizations/:orgID/add-user
    // If you're BCeID: navigate to /organization/add-user
    if (!isCurrentUserLoading && hasRoles(roles.government)) {
      navigate(buildPath(ROUTES.ORGANIZATIONS.ADD_USER, { orgID }))
    } else {
      navigate(buildPath(ROUTES.ORGANIZATION.ADD_USER))
    }
  }

  // Use the organization users hook
  const queryData = useOrganizationUsers(
    orgID ?? currentUser?.organization?.organizationId,
    paginationOptions
  )

  return (
    <BCBox mt={1} px={0}>
      {/* New user button (only if user has roles) */}
      <BCBox
        my={2}
        sx={{
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap'
        }}
      >
        <Role roles={[roles.administrator, roles.manage_users]}>
          <BCButton
            variant="contained"
            size="small"
            color="primary"
            sx={{
              textTransform: 'none'
            }}
            onClick={handleNewUserClick}
            startIcon={
              <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
            }
          >
            <BCTypography variant="button">{t('org:newUsrBtn')}</BCTypography>
          </BCButton>
        </Role>

        <ClearFiltersButton
          data-test="clear-filters-button"
          onClick={handleClearFilters}
          sx={{
            minWidth: 'fit-content',
            whiteSpace: 'nowrap'
          }}
        />
      </BCBox>

      {/* The users data grid */}
      <BCBox sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey={gridKey}
          columnDefs={getUserColumnDefs(t)}
          queryData={queryData}
          dataKey="users"
          paginationOptions={paginationOptions}
          onPaginationChange={setPaginationOptions}
          getRowId={getRowId}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          defaultColDef={defaultColDef}
          enableCopyButton={false}
          enableResetButton={false}
        />
      </BCBox>
    </BCBox>
  )
}
