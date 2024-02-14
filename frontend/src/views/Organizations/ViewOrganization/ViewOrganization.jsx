import colors from '@/themes/base/colors.js'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { IconButton } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ROUTES, apiRoutes } from '@/constants/routes'
import { useTranslation } from 'react-i18next'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import {
  defaultFilterModel,
  defaultSortModel,
  getUserColumnDefs
} from './_schema'
import { useNavigate, useParams } from 'react-router-dom'
import { constructAddress } from '@/utils/constructAddress'
import Loading from '@/components/Loading'
import { useOrganization } from '@/hooks/useOrganization'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { phoneNumberFormatter } from '@/utils/formatters'

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
  const navigate = useNavigate()
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
    navigate(`${ROUTES.ADMIN_USERS}/${params.data.user_profile_id}`)
  })
  const getRowId = useCallback((params) => params.data.user_profile_id)
  const gridRef = useRef()

  useEffect(() => {
    if (gridRef.current) {
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

  if (isLoading) {
    return <Loading />
  }

  return (
    <>
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
            <OrgDetailTypography>{orgData.name}</OrgDetailTypography>
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
              {orgData.org_status.status}
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
      <BCBox sx={{ height: '36rem', width: '100%' }}>
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
              filter: orgID
            }
          ]}
          handleGridKey={handleGridKey}
          handleRowClicked={handleRowClicked}
          enableCopyButton={false}
        />
      </BCBox>
    </>
  )
}
