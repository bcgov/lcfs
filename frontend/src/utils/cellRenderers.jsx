import BCBadge from '@/components/BCBadge'
import BCBox from '@/components/BCBox'
import { roles } from '@/constants/roles'
import { ORGANIZATION_STATUS } from '@/constants/statuses'
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
          badgeContent={props.data.isActive ? 'active' : 'inactive'}
          color={props.data.isActive ? 'success' : 'smoky'}
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
  const statusArr = Object.entries(ORGANIZATION_STATUS)
  const statusColorArr = ['success', 'info', 'warning', 'error']
  const statusIndex = statusArr.indexOf(props.data.orgStatus.status)
  return (
    <Link
      to={props.node?.id && location.pathname + '/' + props?.node?.id}
      style={{ color: '#000' }}
    >
      <BCBox sx={{ width: '100%', height: '100%' }}>
        <BCBox
          mt={1}
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
            sx={{
              '& .MuiBadge-badge': { minWidth: '120px', fontSize: '0.7rem' }
            }}
          />
        </BCBox>
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
      <BCBox sx={{ width: '100%', height: '100%' }}>
        <Stack
          component="div"
          direction={{ md: 'coloumn', lg: 'row' }}
          spacing={0}
          p={1}
          useFlexGap
          flexWrap="wrap"
          key={props.data.userProfileId}
        >
          {props.data.isActive &&
            props.data.roles
              .filter(
                (r) => r.name !== roles.government && r.name !== roles.supplier
              )
              .map((role) => (
                <BCBadge
                  key={role.roleId}
                  sx={{
                    '& .MuiBadge-badge': { fontSize: '0.7rem' },
                    margin: '2px'
                  }}
                  badgeContent={role.name}
                  color={role.isGovernmentRole ? 'primary' : 'secondary'}
                  variant="outlined"
                  size="md"
                />
              ))}{' '}
        </Stack>
      </BCBox>
    </Link>
  )
}

export const RoleSpanRenderer = (props) => (
  <>
    {props.data.roles
      .filter((r) => r.name !== roles.government && r.name !== roles.supplier)
      .map((role) => (
        <BCBadge
          key={role.roleId}
          sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}
          badgeContent={role.name}
          color={role.isGovernmentRole ? 'primary' : 'secondary'}
          variant="outlined"
          size="md"
        />
      ))}
  </>
)
