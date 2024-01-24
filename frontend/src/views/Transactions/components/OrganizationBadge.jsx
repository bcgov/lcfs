import { PropTypes } from 'prop-types'
import BCBadge from '@/components/BCBadge'
import { Stack, Typography } from '@mui/material'

export const OrganizationBadge = ({ content, isGovernmentUser }) => (
  <BCBadge
    badgeContent={
      isGovernmentUser ? (
        <Stack direction="column">
          <Typography variant="body4">{content}</Typography>
          <Typography variant="body4">Balance: 40,000</Typography>
          <Typography variant="body4">Registered: Yes</Typography>
        </Stack>
      ) : (
        content
      )
    }
    color={'primary'}
    variant="outlined"
    size="md"
    sx={({ palette: { primary } }) => ({
      height: '90px',
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
  content: PropTypes.string.isRequired,
  isGovernmentUser: PropTypes.bool.isRequired
}
