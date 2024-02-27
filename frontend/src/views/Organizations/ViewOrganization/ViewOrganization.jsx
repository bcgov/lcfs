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
import { phoneNumberFormatter } from '@/utils/formatters'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  defaultFilterModel,
  defaultSortModel,
  getUserColumnDefs
} from './_schema'

const OrgDetailTypography = ({ bold, children, ...rest }) => {
  return (
    <BCTypography fontSize={16} fontWeight={bold && 'bold'} {...rest}>
      {children}
    </BCTypography>
  )
}

export const ViewOrganization = () => {
  const { t } = useTranslation(['common', 'org'])
  const [showActive, setShowActive] = useState(true)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const navigate = useNavigate()
  const location = useLocation()
  const { orgID } = useParams()
  const { data: currentUser, isLoading: isCurrentUserLoading } =
    useCurrentUser()
  const { data: orgData, isLoading } = useOrganization(orgID)
  const handleEditClick = () => {
    navigate(ROUTES.ORGANIZATIONS_EDIT.replace(':orgID', orgID), {
      state: { orgID, isEditMode: true }
    })
  }

  const [gridKey, setGridKey] = useState(`users-grid-${orgID}-active`)
  const handleGridKey = useCallback(() => {
    if (showActive) {
      setGridKey(`users-grid-${orgID}-active`)
    } else {
      setGridKey(`users-grid-${orgID}-inactive`)
    }
  }, [])

  const gridOptions = {
    overlayNoRowsTemplate: 'No users found',
    includeHiddenColumnsInQuickFilter: true
  }
  const handleRowClicked = useCallback((params) => {
    navigate(
      ROUTES.ORGANIZATIONS_VIEWUSER.replace(':orgID', orgID).replace(
        ':userID',
        params.data.user_profile_id
      )
    )
  })
  const getRowId = useCallback((params) => params.data.user_profile_id)
  const gridRef = useRef()

  useEffect(() => {
    if (gridRef.current) {
      // clear any previous filters
      localStorage.removeItem(`${gridKey}-filter`)
      const statusFilter = gridRef?.current?.api?.getFilterInstance('is_active')
      const orgFilter =
        gridRef?.current?.api?.getFilterInstance('organization_id')
      if (statusFilter) {
        statusFilter.setModel({
          type: 'equals',
          filter: showActive ? 'Active' : 'Inactive'
        })
      }
      if (orgFilter) {
        orgFilter.setModel({
          type: 'equals',
          filter: parseInt(orgID)
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
        {!isCurrentUserLoading && currentUser.is_government_user && (
          <IconButton
            aria-label="edit"
            color="primary"
            onClick={handleEditClick}
          >
            <EditIcon />
          </IconButton>
        )}
      </BCTypography>
      <BCBox p={3} bgColor={colors.grey[300]}>
        <BCBox display="flex" gap={10}>
          <BCBox
            display="grid"
            gridTemplateColumns="auto auto"
            gap={1}
            alignItems="end"
          >
            <OrgDetailTypography bold>
              {t('org:legalNameLabel')}:
            </OrgDetailTypography>
            <OrgDetailTypography>{orgData.name}</OrgDetailTypography>
            <OrgDetailTypography bold>
              {t('org:operatingNameLabel')}:
            </OrgDetailTypography>
            <OrgDetailTypography>{orgData.operating_name}</OrgDetailTypography>
            <OrgDetailTypography bold>
              {t('org:phoneNbrLabel')}:
            </OrgDetailTypography>
            <OrgDetailTypography>
              {phoneNumberFormatter({ value: orgData.phone })}
            </OrgDetailTypography>
            <OrgDetailTypography bold>
              {t('org:emailAddrLabel')}:
            </OrgDetailTypography>
            <OrgDetailTypography>{orgData.email}</OrgDetailTypography>
          </BCBox>
          <BCBox
            display="grid"
            gridTemplateColumns="auto auto"
            gap={1}
            alignItems="end"
          >
            <OrgDetailTypography bold>
              {t('org:serviceAddrLabel')}:
            </OrgDetailTypography>
            <OrgDetailTypography>
              {constructAddress(orgData.org_address)}
            </OrgDetailTypography>
            <OrgDetailTypography bold>
              {t('org:bcAddrLabel')}:
            </OrgDetailTypography>
            <OrgDetailTypography>
              {constructAddress(orgData.org_attorney_address)}
            </OrgDetailTypography>
            <OrgDetailTypography bold>
              {t('org:regTrnLabel')}:
            </OrgDetailTypography>
            <OrgDetailTypography>
              {orgData.org_status.status === 'Registered'
                ? 'Yes — A registered organization is able to transfer compliance units.'
                : 'No — An organization must be registered to transfer compliance units.'}
            </OrgDetailTypography>
          </BCBox>
        </BCBox>
        {!isCurrentUserLoading && !currentUser.is_government_user && (
          <OrgDetailTypography mt={1}>
            Email <a href={`mailto:${t('lcfsEmail')}`}>{t('lcfsEmail')}</a>
            {t('org:toUpdateMsg')}
          </OrgDetailTypography>
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
                  <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
                }
                onClick={() =>
                  navigate(
                    ROUTES.ORGANIZATIONS_ADDUSER.replace(':orgID', orgID)
                  )
                }
              >
                <BCTypography variant="button">
                  {t('org:newUsrBtn')}
                </BCTypography>
              </BCButton>
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
          apiEndpoint={apiRoutes.listUsers}
          apiData={'users'}
          columnDefs={getUserColumnDefs(t)}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          defaultSortModel={defaultSortModel}
          defaultFilterModel={[
            ...defaultFilterModel,
            {
              filterType: 'number',
              type: 'equals',
              field: 'organization_id',
              filter: orgID ?? currentUser?.organization?.organization_id
            }
          ]}
          handleGridKey={handleGridKey}
          handleRowClicked={handleRowClicked}
          enableCopyButton={false}
          enableResetButton={false}
        />
      </BCBox>
    </>
  )
}
