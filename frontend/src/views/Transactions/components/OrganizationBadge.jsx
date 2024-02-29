import { PropTypes } from 'prop-types'
import BCBadge from '@/components/BCBadge'
import { Stack, Typography } from '@mui/material'

export const OrganizationBadge = ({
  organizationName,
  totalBalance,
  reservedBalance,
  registeredStatus,
  isGovernmentUser,
  TransferStatus
}) => (
  <BCBadge
    badgeContent={
      isGovernmentUser && ['Submitted', 'Recommended'].includes(TransferStatus) ? (
        <Stack direction="column">
          <Typography variant="body4">{organizationName}</Typography>
          <Typography variant="body4">
            Balance: {totalBalance.toLocaleString()} ({reservedBalance.toLocaleString()})
          </Typography>
          <Typography variant="body4">
            Registered: {registeredStatus ? 'Yes' : 'No'}
          </Typography>
        </Stack>
      ) : (
        <Typography variant="body4">{organizationName}</Typography>
      )
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

OrganizationBadge.propTypes = {
  organizationName: PropTypes.string.isRequired,
  totalBalance: PropTypes.number,
  reservedBalance: PropTypes.number,
  registeredStatus: PropTypes.bool,
  isGovernmentUser: PropTypes.bool.isRequired,
  TransferStatus: PropTypes.string.isRequired,
}
