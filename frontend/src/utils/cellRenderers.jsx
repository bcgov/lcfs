import BCBadge from '@/components/BCBadge'
import BCBox from '@/components/BCBox'
import { roles } from '@/constants/roles'
import { Stack } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'

export const LinkRenderer = (props) => {
  const location = useLocation()
  return (
    <Link
      to={location.pathname + '/' + props?.node?.id}
      style={{ color: '#000' }}
    >
      <BCBox component="div" sx={{ width: '100%', height: '100%' }}>
        {props.valueFormatted || props.value}
      </BCBox>
    </Link>
  )
}

export const StatusRenderer = (props) => {
  const location = useLocation()
  return (
    <Link
      to={props.node && location.pathname + '/' + props.node.id}
      style={{ color: '#000' }}
    >
      <BCBox
        component={props.isView ? 'span' : 'div'}
        mt={1}
        sx={{ width: '100%', height: '100%' }}
      >
        <BCBadge
          badgeContent={props.data.is_active ? 'active' : 'inactive'}
          color={props.data.is_active ? 'success' : 'smoky'}
          variant="gradient"
          size="md"
          sx={
            props.isView
              ? { '& .MuiBadge-badge': { fontSize: '0.7rem' } }
              : {
                  display: 'flex',
                  justifyContent: 'center',
                  '& .MuiBadge-badge': { fontSize: '0.625rem' }
                }
          }
        />
      </BCBox>
    </Link>
  )
}

export const OrgStatusRenderer = (props) => {
  const location = useLocation()
  const statusArr = ['Registered', 'Unregistered', 'Suspended', 'Canceled']
  const statusColorArr = ['success', 'info', 'warning', 'error']
  const statusIndex = statusArr.indexOf(props.data.org_status.status)
  return (
    <Link
      to={props.node?.id && location.pathname + '/' + props?.node?.id}
      style={{ color: '#000' }}
    >
      <BCBox
        m={1}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }}
      >
        <BCBadge
          badgeContent={statusArr[statusIndex]}
          color={statusColorArr[statusIndex]}
          variant="contained"
          size="lg"
          sx={{
            '& .MuiBadge-badge': { minWidth: '120px', fontSize: '0.7rem' }
          }}
        />
      </BCBox>
    </Link>
  )
}

export const TransactionStatusRenderer = (props) => {
  const statusArr = ['Draft', 'Recommended', 'Sent', 'Submitted', 'Approved', 
                     'Recorded', 'Refused', 'Deleted', 'Declined', 'Rescinded']
  const statusColorArr = ['info', 'info', 'info', 'info', 'success', 
                          'success', 'error', 'error', 'error', 'error']
  const statusIndex = statusArr.indexOf(props.data.status)
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
        sx={{ '& .MuiBadge-badge': { minWidth: '120px', fontSize: '0.7rem' } }}
      />
    </BCBox>
  )
}

// if the status of the user is in-active then don't show their previously held roles
export const RoleRenderer = (props) => {
  const location = useLocation()
  return (
    <Link
      to={props.node?.id && location.pathname + '/' + props.node?.id}
      style={{ color: '#000' }}
    >
      <Stack
        component="div"
        direction={{ md: 'coloumn', lg: 'row' }}
        spacing={0}
        p={1}
        sx={{ width: '100%', height: '100%' }}
        useFlexGap
        flexWrap="wrap"
        key={props.data.user_profile_id}
      >
        {props.data.is_active &&
          props.data.roles
            .filter(
              (r) => r.name !== roles.government && r.name !== roles.supplier
            )
            .map((role) => (
              <BCBadge
                key={role.role_id}
                sx={{
                  '& .MuiBadge-badge': { fontSize: '0.7rem' },
                  margin: '2px'
                }}
                badgeContent={role.name}
                color={role.is_government_role ? 'primary' : 'secondary'}
                variant="outlined"
                size="md"
              />
            ))}{' '}
      </Stack>
    </Link>
  )
}

export const RoleSpanRenderer = (props) => (
  <>
    {props.data.roles
      .filter((r) => r.name !== roles.government && r.name !== roles.supplier)
      .map((role) => (
        <BCBadge
          key={role.role_id}
          sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}
          badgeContent={role.name}
          color={role.is_government_role ? 'primary' : 'secondary'}
          variant="outlined"
          size="md"
        />
      ))}
  </>
)
