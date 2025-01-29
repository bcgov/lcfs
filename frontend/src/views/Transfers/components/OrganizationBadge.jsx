import { PropTypes } from 'prop-types'
import BCBadge from '@/components/BCBadge'
import { Stack } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { useOrganizationBalance } from '@/hooks/useOrganization'

export const OrganizationBadge = ({
  organizationId,
  organizationName,
  transferStatus,
  isGovernmentUser
}) => {
  let orgData = {}
  if (isGovernmentUser) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    orgData = useOrganizationBalance(organizationId)
  }
  const { data: orgInfo } = orgData

  return (
    <BCBadge
      badgeContent={
        <>
          <Stack direction="column">
            <BCTypography variant="body4">{organizationName}</BCTypography>
            {['Submitted', 'Recommended'].includes(transferStatus) && (
              <Role roles={[roles.government]}>
                <BCTypography variant="body4">
                  Balance: {orgInfo?.totalBalance.toLocaleString()} (
                  {Math.abs(orgInfo?.reservedBalance).toLocaleString()})
                </BCTypography>
                <BCTypography variant="body4">
                  Registered: {orgInfo?.registered ? 'Yes' : 'No'}
                </BCTypography>
              </Role>
            )}
          </Stack>
        </>
      }
      color={'primary'}
      variant="outlined"
      size="md"
      sx={({ palette: { primary } }) => ({
        minHeight: '90px',
        padding: '4px',
        display: 'flex',
        justifyContent: 'center',
        '& .MuiBadge-badge': {
          border: `4px solid ${primary.main}`,
          borderRadius: '20px',
          minWidth: '300px',
          textTransform: 'capitalize',
          fontWeight: '100',
          fontSize: '1rem'
        }
      })}
    />
  )
}

OrganizationBadge.propTypes = {
  organizationId: PropTypes.number.isRequired,
  organizationName: PropTypes.string.isRequired,
  isGovernmentUser: PropTypes.bool.isRequired,
  transferStatus: PropTypes.string.isRequired
}
