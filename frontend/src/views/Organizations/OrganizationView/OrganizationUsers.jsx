import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
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
  const [resetGridFn, setResetGridFn] = useState(null)

  const gridRef = useRef()

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
          // For BCeID: /organizations/:orgID/:userID
          // For IDIR (supplier role): /organization/:userID
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

  const handleSetResetGrid = useCallback((fn) => {
    setResetGridFn(() => fn)
  }, [])

  const handleClearFilters = useCallback(() => {
    if (resetGridFn) {
      resetGridFn()
    }
  }, [resetGridFn])

  const handleNewUserClick = () => {
    // If you are IDIR: navigate to /organizations/:orgID/add-user
    // If you’re BCeID: navigate to /organization/add-user
    if (!isCurrentUserLoading && hasRoles(roles.government)) {
      navigate(buildPath(ROUTES.ORGANIZATIONS.ADD_USER, { orgID }))
    } else {
      navigate(buildPath(ROUTES.ORGANIZATION.ADD_USER))
    }
  }

  return (
    <BCBox mt={3}>
      {/* Title + buttons */}
      <BCBox my={2}>
        <BCTypography
          variant="h5"
          color="primary"
          data-test="active-users-heading"
        >
          {t('org:usersLabel')}
        </BCTypography>{' '}
      </BCBox>

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
        <BCDataGridServer
          gridRef={gridRef}
          apiEndpoint={buildPath(apiRoutes.orgUsers, {
            orgID: orgID ?? currentUser?.organization?.organizationId
          })}
          apiData="users"
          columnDefs={getUserColumnDefs(t)}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          defaultSortModel={defaultSortModel}
          handleGridKey={handleGridKey}
          defaultColDef={defaultColDef}
          enableCopyButton={false}
          enableResetButton={false}
          onSetResetGrid={handleSetResetGrid}
        />
      </BCBox>
    </BCBox>
  )
}
