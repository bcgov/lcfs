import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
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
import '@/constants/routes'
import { Role } from '@/components/Role'
import { useOrganizationUsers } from '@/hooks/useOrganizations'
import { toOrganizationUsersPaginationParams } from './userPagination'
import type {
  BCGridRef,
  BCPaginationOptions,
  BCGridQueryData
} from '@/components/BCDataGrid/types'
import type { GetRowIdParams } from 'ag-grid-community'
import type { BCGridRow } from '@/components/BCDataGrid/types'

type UserGridRow = { userProfileId?: string | number }
const isUserGridRow = (value: unknown): value is UserGridRow =>
  typeof value === 'object' && value !== null && 'userProfileId' in value
const isGridResponseData = (
  value: unknown
): value is NonNullable<BCGridQueryData['data']> =>
  typeof value === 'object' && value !== null

export const OrganizationUsers = () => {
  const { t } = useTranslation(['common', 'org'])
  useLocation()
  const navigate = useNavigate()
  const { orgID } = useParams()
  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles
  } = useCurrentUser()

  const gridKey = `users-grid-${orgID}-active`

  const gridRef = useRef<BCGridRef['current'] | null>(null)

  // Pagination state
  const [paginationOptions, setPaginationOptions] =
    useState<BCPaginationOptions>({
      page: 1,
      size: 10,
      sortOrders: defaultSortModel,
      filters: []
    })

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('org:noUsersFound'),
      includeHiddenColumnsInQuickFilter: true
    }),
    [t]
  )

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        isAbsolute: true,
        url: (row: { data: unknown }) => {
          const userID = isUserGridRow(row.data)
            ? row.data.userProfileId
            : undefined
          if (userID == null) return ''
          // For IDIR: /organizations/:orgID/users/:userID
          // For BCeID (supplier role): /organization/users/:userID
          // But typically we do the organizations route with orgID if you have it:
          if (hasRoles(roles.supplier)) {
            return buildPath(ROUTES.ORGANIZATION.VIEW_USER, {
              userID
            })
          } else {
            return buildPath(ROUTES.ORGANIZATIONS.VIEW_USER, {
              orgID: orgID ?? currentUser?.organization?.organizationId ?? '',
              userID
            })
          }
        }
      }
    }),
    [currentUser?.organization?.organizationId, orgID, hasRoles]
  )

  const getRowId = useCallback(
    (params: GetRowIdParams<BCGridRow>) =>
      String(params.data?.userProfileId ?? ''),
    []
  )

  useCallback(() => {
    try {
      gridRef.current?.api?.setFilterModel(null)
    } catch {
      // no-op
    }
    setPaginationOptions((prev) => ({ ...prev, page: 1, filters: [] }))
  }, [])

  const handleNewUserClick = () => {
    // If you are IDIR: navigate to /organizations/:orgID/add-user
    // If you're BCeID: navigate to /organization/add-user
    if (!isCurrentUserLoading && hasRoles(roles.government)) {
      if (orgID) {
        navigate(buildPath(ROUTES.ORGANIZATIONS.ADD_USER, { orgID }))
      }
    } else {
      navigate(buildPath(ROUTES.ORGANIZATION.ADD_USER))
    }
  }

  // Use the organization users hook
  const queryPaginationOptions =
    toOrganizationUsersPaginationParams(paginationOptions)
  const usersQuery = useOrganizationUsers(
    orgID ?? currentUser?.organization?.organizationId,
    queryPaginationOptions,
    {}
  )
  const queryData: BCGridQueryData = {
    data: isGridResponseData(usersQuery.data) ? usersQuery.data : null,
    error: usersQuery.error,
    isError: usersQuery.isError,
    isLoading: usersQuery.isLoading
  }

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
          defaultColDef={defaultColDef}
          enableCopyButton={false}
          enableResetButton={false}
        />
      </BCBox>
    </BCBox>
  )
}
