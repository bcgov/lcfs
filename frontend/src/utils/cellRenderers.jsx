import BCBadge from '@/components/BCBadge'
import BCBox from '@/components/BCBox'
import { Stack } from '@mui/material'

export const StatusRenderer = (props) => {
  return props.data.is_active ? (
    <BCBox mt={1}>
      <BCBadge
        badgeContent="active"
        color="success"
        variant="gradient"
        size="md"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          '& .MuiBadge-badge': { fontSize: '0.625rem' }
        }}
      />
    </BCBox>
  ) : (
    <BCBox mt={1}>
      <BCBadge
        badgeContent="inactive"
        color="smoky"
        variant="gradient"
        size="md"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          '& .MuiBadge-badge': { fontSize: '0.625rem' }
        }}
      />
    </BCBox>
  )
}

export const GovernmentRoleRenderer = (props) => {
  return (
    <BCBox ml={2}>
      <BCBadge
        badgeContent={
          props.data.is_government_role ? 'Government' : 'Fuel Supplier'
        }
        color={props.data.is_government_role ? 'primary' : 'secondary'}
        variant="contained"
        size="md"
        sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem' } }}
      />
    </BCBox>
  )
}

export const OrgStatusRenderer = (props) => {
  const statusArr = ['Registered', 'Unregistered', 'Suspended', 'Canceled']
  const statusColorArr = ['success', 'info', 'warning', 'error']
  const statusIndex = statusArr.indexOf(props.data.org_status.status)
  return (
    <BCBox
      m={1}
      sx={{
        display: 'flex',
        justifyContent: 'center'
      }}
    >
      <BCBadge
        badgeContent={statusArr[statusIndex]}
        color={statusColorArr[statusIndex]}
        variant="contained"
        size="lg"
        sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}
      />
    </BCBox>
  )
}

export const RoleRenderer = (props) => {
  return (
    <Stack
      component="div"
      direction={{ md: 'coloumn', lg: 'row' }}
      spacing={0}
      p={1}
      useFlexGap
      flexWrap="wrap"
      key={props.data.user_profile_id}
    >
      {props.data.roles.map((role) => (
        <BCBadge
          key={role.role_id}
          sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}
          badgeContent={role.name}
          color={role.is_government_role ? 'primary' : 'secondary'}
          variant="outlined"
          size="md"
        />
      ))}
    </Stack>
  )
}
