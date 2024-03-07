// components
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCAlert from '@/components/BCAlert'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import Loading from '@/components/Loading'
import { IconButton } from '@mui/material'
// icons
import colors from '@/themes/base/colors.js'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import EditIcon from '@mui/icons-material/Edit'
// hooks
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ROUTES, apiRoutes } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOrganization } from '@/hooks/useOrganization'
import { constructAddress } from '@/utils/constructAddress'
import { calculateRowHeight, phoneNumberFormatter } from '@/utils/formatters'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { defaultSortModel, getUserColumnDefs } from './_schema'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'

export const ViewOrganization = () => {
  const { t } = useTranslation(['common', 'org'])
  const [showActive, setShowActive] = useState(true)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridSize, setGridSize] = useState({ height: '100%', width: '100%' })

  const navigate = useNavigate()
  const location = useLocation()
  const { orgID } = useParams()
  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles
  } = useCurrentUser()
  const { data: orgData, isLoading } = useOrganization(orgID)
  const handleEditClick = () => {
    navigate(
      ROUTES.ORGANIZATIONS_EDIT.replace(
        ':orgID',
        orgID || currentUser?.organization?.organization_id
      ),
      {
        state: {
          orgID: orgID || currentUser?.organization?.organization_id,
          isEditMode: true
        }
      }
    )
  }

  const [gridKey, setGridKey] = useState(`users-grid-${orgID}-active`)
  const handleGridKey = useCallback(() => {
    if (showActive) {
      setGridKey(`users-grid-${orgID}-active`)
    } else {
      setGridKey(`users-grid-${orgID}-inactive`)
    }
  }, [])

  const getRowHeight = useCallback((params) => {
    const colWidth = params.api.getColumn('role').getActualWidth()
    const size = params.data.roles.length
    return calculateRowHeight(colWidth, size-1)
  }, [])

  const onColumnResized = useCallback((params) => {
    const colWidth = params.api.getColumn('role').getActualWidth()
    params.api.forEachNode((node) => {
      const size = node.data?.roles?.length
      const rowHeight = calculateRowHeight(colWidth, size-1)
      node.setRowHeight(rowHeight)
    })
  }, [])

  const gridOptions = {
    overlayNoRowsTemplate: 'No users found',
    includeHiddenColumnsInQuickFilter: true
  }
  const handleRowClicked = useCallback((params) =>
    // Based on the user Type (BCeID or IDIR) navigate to specific view
    hasRoles(roles.supplier)
      ? navigate(
          ROUTES.ORGANIZATION_VIEWUSER.replace(
            ':userID',
            params.data.user_profile_id
          )
        )
      : navigate(
          ROUTES.ORGANIZATIONS_VIEWUSER.replace(':orgID', orgID).replace(
            ':userID',
            params.data.user_profile_id
          )
        )
  )
  const getRowId = useCallback((params) => params.data.user_profile_id)
  const gridRef = useRef()

  useEffect(() => {
    if (gridRef.current) {
      // clear any previous filters
      localStorage.removeItem(`${gridKey}-filter`)
      const statusFilter = gridRef?.current?.api?.getFilterInstance('is_active')
      if (statusFilter) {
        statusFilter.setModel({
          type: 'equals',
          filter: showActive ? 'Active' : 'Inactive'
        })
      }
      gridRef?.current?.api?.onFilterChanged()
    }
  }, [showActive])

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  if (isLoading) {
    return <Loading />
  }

  return (
    <>
      {alertMessage && (
        <BCAlert data-test="alert-box" severity={alertSeverity}>
          {alertMessage}
        </BCAlert>
      )}
      <BCTypography variant="h5" color="primary">
        {orgData.name}{' '}
        <Role roles={[roles.administrator]}>
          <IconButton
            aria-label="edit"
            color="primary"
            onClick={handleEditClick}
          >
            <EditIcon />
          </IconButton>
        </Role>
      </BCTypography>
      <BCBox p={3} bgColor={colors.grey[300]}>
        <BCBox display="flex" gap={10}>
          <BCBox
            display="grid"
            gridTemplateColumns="auto auto"
            gap={1}
            alignItems="end"
          >
            <BCTypography variant="label">
              {t('org:legalNameLabel')}:
            </BCTypography>
            <BCTypography variant="body4">{orgData.name}</BCTypography>
            <BCTypography variant="label">
              {t('org:operatingNameLabel')}:
            </BCTypography>
            <BCTypography variant="body4">
              {orgData.operating_name || orgData.name}
            </BCTypography>
            <BCTypography variant="label">
              {t('org:phoneNbrLabel')}:
            </BCTypography>
            <BCTypography variant="body4">
              {phoneNumberFormatter({ value: orgData.phone })}
            </BCTypography>
            <BCTypography variant="label">
              {t('org:emailAddrLabel')}:
            </BCTypography>
            <BCTypography variant="body4">{orgData.email}</BCTypography>
          </BCBox>
          <BCBox
            display="grid"
            gridTemplateColumns="auto auto"
            gap={1}
            alignItems="end"
          >
            <BCTypography variant="label">
              {t('org:serviceAddrLabel')}:
            </BCTypography>
            <BCTypography variant="body4">
              {constructAddress(orgData.org_address)}
            </BCTypography>
            <BCTypography variant="label">{t('org:bcAddrLabel')}:</BCTypography>
            <BCTypography variant="body4">
              {constructAddress(orgData.org_attorney_address)}
            </BCTypography>
            <BCTypography variant="label">{t('org:regTrnLabel')}:</BCTypography>
            <BCTypography variant="body4">
              {orgData.org_status.status === 'Registered'
                ? 'Yes — A registered organization is able to transfer compliance units.'
                : 'No — An organization must be registered to transfer compliance units.'}
            </BCTypography>
          </BCBox>
        </BCBox>
        {!isCurrentUserLoading && !hasRoles(roles.government) && (
          <BCBox mt={2}>
            <BCTypography variant="body4">
              Email <a href={`mailto:${t('lcfsEmail')}`}>{t('lcfsEmail')}</a>
              {t('org:toUpdateMsg')}
            </BCTypography>
          </BCBox>
        )}
      </BCBox>
      <BCBox
        sx={{
          display: 'flex',
          flexDirection: 'column', // default layout is row
          flexWrap: 'wrap', // allow items to wrap to the next row
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          textTransform: 'none'
        }}
        my={2}
      >
        {showActive ? (
          <>
            <BCBox component="div">
              <Role roles={[roles.administrator, roles.manage_users]}>
                <BCButton
                  variant="contained"
                  size="small"
                  color="primary"
                  sx={{
                    textTransform: 'none',
                    marginRight: '8px',
                    marginBottom: '8px'
                  }}
                  startIcon={
                    <FontAwesomeIcon
                      icon={faCirclePlus}
                      className="small-icon"
                    />
                  }
                  onClick={() =>
                    !isCurrentUserLoading && hasRoles(roles.government)
                      ? navigate(
                          ROUTES.ORGANIZATIONS_ADDUSER.replace(':orgID', orgID)
                        )
                      : navigate(ROUTES.ORGANIZATION_ADDUSER)
                  }
                >
                  <BCTypography variant="button">
                    {t('org:newUsrBtn')}
                  </BCTypography>
                </BCButton>
              </Role>
              <BCButton
                variant="outlined"
                size="small"
                color="primary"
                sx={{
                  textTransform: 'none',
                  marginRight: '8px',
                  marginBottom: '8px',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => setShowActive(false)}
              >
                <BCTypography variant="button">
                  {t('org:showInactiveUsersBtn')}
                </BCTypography>
              </BCButton>
            </BCBox>
            <BCTypography variant="h5" mt={1} color="primary">
              {t('org:activeUsersBtn')}
            </BCTypography>
          </>
        ) : (
          <>
            <BCButton
              variant="outlined"
              size="small"
              color="primary"
              sx={{
                textTransform: 'none',
                marginRight: '8px',
                marginBottom: '8px',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setShowActive(true)}
            >
              <BCTypography variant="subtitle2">
                {t('org:showActiveUsersBtn')}
              </BCTypography>
            </BCButton>
            <BCTypography variant="h5" mt={1} color="primary">
              {t('org:inactiveUsersBtn')}
            </BCTypography>
          </>
        )}
      </BCBox>
      <BCBox sx={{ height: '100%', width: '100%' }}>
        <BCDataGridServer
          gridRef={gridRef}
          apiEndpoint={apiRoutes.orgUsers
            .replace(
              ':orgID',
              orgID || currentUser?.organization?.organization_id
            )
            .concat(showActive ? '?status=Active' : '?status=Inactive')}
          apiData={'users'}
          columnDefs={getUserColumnDefs(t)}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          defaultSortModel={defaultSortModel}
          handleGridKey={handleGridKey}
          handleRowClicked={handleRowClicked}
          enableCopyButton={false}
          enableResetButton={false}
          getRowHeight={getRowHeight}
          onColumnResized={onColumnResized}
        />
      </BCBox>
    </>
  )
}
