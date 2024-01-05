import BCBadge from '@/components/BCBadge'
import BCBox from '@/components/BCBox'
import { Stack } from '@mui/material'

export const StatusRenderer = (props) => {
  const cellValue = props.valueFormatted ? props.valueFormatted : props.value

  return cellValue === 'true' ? (
    <BCBox ml={2}>
      <BCBadge
        badgeContent="active"
        color="success"
        variant="gradient"
        size="md"
      />
    </BCBox>
  ) : (
    <BCBox ml={1.5}>
      <BCBadge
        badgeContent="inactive"
        color="dark"
        variant="gradient"
        size="md"
      />
    </BCBox>
  )
}

export const GovernmentRoleRenderer = (props) => {
  const cellValue = props.valueFormatted ? props.valueFormatted : props.value
  return cellValue === 'true' ? (
    <BCBox ml={2}>
      <BCBadge
        badgeContent="Government"
        color="primary"
        variant="contained"
        size="md"
      />
    </BCBox>
  ) : (
    <BCBox ml={2}>
      <BCBadge
        badgeContent="Fuel Supplier"
        color="secondary"
        variant="contained"
        size="md"
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
          sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem' } }}
          badgeContent={role.name}
          color={role.is_government_role ? 'primary' : 'secondary'}
          variant="outlined"
          size="md"
        />
      ))}
    </Stack>
  )
}
