import { Stack, IconButton } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import BCTypography from '@/components/BCTypography'
// react components
import { useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useUser } from '@/hooks/useUser'
import Loading from '@/components/Loading'
import { phoneNumberFormatter } from '@/utils/formatters'
import { RoleSpanRenderer, StatusRenderer } from '@/utils/cellRenderers'
import BCDataGridClient from '@/components/BCDataGrid/BCDataGridClient'
import { userActivityColDefs } from '@/views/Admin/AdminMenu/components/_schema'

export const ViewUser = () => {
  const gridRef = useRef()
  const gridOptions = {
    overlayNoRowsTemplate: 'No previous user activities found',
    suppressMenuHide: false,
    paginationPageSize: 20
  }

  const { userID } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useUser(userID)

  const handleEditClick = () => {
    navigate(`/admin/users/${userID}/edit-user`)
  }
  if (isLoading) return <Loading />

  return (
    <div>
      <BCTypography variant="h5" color="primary" mb={1}>
        {data.first_name + ' ' + data.last_name}&nbsp;
        <IconButton aria-label="edit" color="primary" onClick={handleEditClick}>
          <EditIcon />
        </IconButton>
      </BCTypography>
      <Stack direction="column" spacing={0.5} mb={2}>
        <BCTypography variant="body4">
          <strong>Organization:</strong>&nbsp;
          {data.organization?.name || 'Government of British Columbia'}
        </BCTypography>
        <BCTypography variant="body4">
          <strong>Email:</strong>&nbsp;{data.email}
        </BCTypography>
        <BCTypography variant="body4">
          <strong>Work Phone:</strong>&nbsp;
          {phoneNumberFormatter({ value: data.phone })}
        </BCTypography>
        <BCTypography variant="body4">
          <strong>Mobile Phone:</strong>&nbsp;
          {phoneNumberFormatter({ value: data.mobile_phone })}
        </BCTypography>
        <BCTypography variant="body4">
          <strong>Status:</strong>&nbsp;{StatusRenderer({ data, isView: true })}
        </BCTypography>
        <BCTypography variant="body4">
          <strong>Roles:</strong>&nbsp;
          {RoleSpanRenderer({ data })}
        </BCTypography>
        <BCTypography variant="body4">
          <strong>Title:</strong>&nbsp;{data.title}
        </BCTypography>
      </Stack>
      <BCTypography variant="h5" color="primary" mb={1}>
        User Activity
      </BCTypography>
      {/* TODO: Once the table data and models are finalized implement below table */}
      <BCDataGridClient
        columnDefs={userActivityColDefs}
        gridRef={gridRef}
        gridKey="user-activity-grid"
        rowData={[]}
        gridOptions={gridOptions}
        getRowId={(data) => data.user_profile_id}
      />
    </div>
  )
}
