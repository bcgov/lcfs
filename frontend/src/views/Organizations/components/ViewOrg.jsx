import colors from '@/themes/base/colors.js'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { IconButton } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import { useCallback, useRef, useState } from 'react'
import { ROUTES } from '@/constants/routes'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { usersColumnDefs } from '@/views/AdminMenu/components/schema'
import { defaultSortModel } from './schema'
import { useNavigate, useParams } from 'react-router-dom'
import { constructAddress } from '@/utils/constructAddress'
import Loading from '@/components/Loading'
import { useOrganization } from '@/hooks/useOrganization'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'

const OrgDetailTypography = ({ bold, children, ...rest }) => {
  return (
    <BCTypography fontSize={16} fontWeight={bold && 'bold'} {...rest}>
      {children}
    </BCTypography>
  )
}

export const ViewOrg = () => {
  const [showActive, setShowActive] = useState(true)
  const navigate = useNavigate()
  const { orgID } = useParams()
  const { data: orgData, isLoading } = useOrganization(orgID)
  const handleEditClick = () => {
    navigate(`/organizations/${orgID}/edit-org`)
  }

  const [gridKey, setGridKey] = useState(`users-grid-${orgID}`)
  const handleGridKey = useCallback(() => {
    setGridKey(`users-grid-${Math.random()}`)
    if (gridRef.current) {
      gridRef.current.api.deselectAll()
    }
  }, [])
  const gridOptions = {
    overlayNoRowsTemplate: 'No users found'
  }
  const handleRowClicked = useCallback((params) => {
    navigate(`${ROUTES.ADMIN_USERS}/${params.data.user_profile_id}`)
  })
  const getRowId = useCallback(() => orgID, [orgID])
  const gridRef = useRef()

  if (isLoading) {
    return <Loading />
  }

  return (
    <>
      <BCTypography variant="h5">
        {orgData.name}{' '}
        <IconButton aria-label="edit" color="primary" onClick={handleEditClick}>
          <EditIcon />
        </IconButton>
      </BCTypography>
      <BCBox p={3} bgColor={colors.background.grey}>
        <BCBox display="flex" gap={10}>
          <BCBox
            display="grid"
            gridTemplateColumns="auto auto"
            gap={1}
            alignItems="end"
          >
            <OrgDetailTypography bold>
              Legal name of organization:
            </OrgDetailTypography>
            <OrgDetailTypography>{orgData.name}</OrgDetailTypography>
            <OrgDetailTypography bold>
              Operating name of organization:
            </OrgDetailTypography>
            <OrgDetailTypography>{orgData.name}</OrgDetailTypography>
            <OrgDetailTypography bold>Telephone:</OrgDetailTypography>
            <OrgDetailTypography>{orgData.phone}</OrgDetailTypography>
            <OrgDetailTypography bold>Email:</OrgDetailTypography>
            <OrgDetailTypography>{orgData.email}</OrgDetailTypography>
          </BCBox>
          <BCBox
            display="grid"
            gridTemplateColumns="auto auto"
            gap={1}
            alignItems="end"
          >
            <OrgDetailTypography bold>
              Address for service (postal address):
            </OrgDetailTypography>
            <OrgDetailTypography>
              {constructAddress(orgData.org_address)}
            </OrgDetailTypography>
            <OrgDetailTypography bold>
              Address in B.C. (at which records are maintained):
            </OrgDetailTypography>
            <OrgDetailTypography>
              {constructAddress(orgData.org_attorney_address)}
            </OrgDetailTypography>
            <OrgDetailTypography bold>
              Registered for credit transfers:
            </OrgDetailTypography>
            <OrgDetailTypography>
              {orgData.org_status.status}
            </OrgDetailTypography>
          </BCBox>
        </BCBox>
        {/* TODO: need to fix below */}
        {/* {!orgData.user.is_government && (
          <OrgDetailTypography mt={1}>
            Email <a href="mailto:lcfs@gov.bc.ca">lcfs@gov.bc.ca</a> to update
            address information.
          </OrgDetailTypography>
        )} */}
      </BCBox>
      <BCBox
        sx={{
          display: 'flex',
          flexDirection: 'row', // default layout is row
          flexWrap: 'wrap', // allow items to wrap to the next row
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          textTransform: 'none'
        }}
        my={2}
      >
        {showActive ? (
          <>
            <BCButton
              variant="contained"
              size="small"
              color="primary"
              sx={{
                textTransform: 'none',
                marginRight: '8px',
                marginBottom: '8px'
              }}
              startIcon={<FontAwesomeIcon icon={faCirclePlus} />}
              onClick={() => navigate(ROUTES.ORGANIZATIONS_ADDUSER)}
            >
              <BCTypography variant="subtitle2">New User</BCTypography>
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
              <BCTypography variant="subtitle2">
                Show Inactive Users
              </BCTypography>
            </BCButton>
          </>
        ) : (
          <BCButton
            variant="outlined"
            size="large"
            color="primary"
            sx={{
              textTransform: 'none',
              marginRight: '8px',
              marginBottom: '8px',
              whiteSpace: 'nowrap'
            }}
            onClick={() => setShowActive(true)}
          >
            <BCTypography variant="subtitle2">Show Active Users</BCTypography>
          </BCButton>
        )}
      </BCBox>
      <BCBox>
        <BCDataGridServer
          gridRef={gridRef}
          apiEndpoint={'users/list'}
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
    </>
  )
}
