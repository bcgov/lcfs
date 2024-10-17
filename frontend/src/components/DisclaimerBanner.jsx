import PropTypes from 'prop-types'
import { Box, Typography } from '@mui/material'
import colors from '@/themes/base/colors'

const DisclaimerBanner = ({ messages }) => {
  return (
    <Box
      sx={{
        backgroundColor: colors.background.grey,
        color: colors.grey[700],
        marginTop: 2,
        marginBottom: 4,
        padding: '10px 15px',
        border: `1px solid ${colors.borderDivider.nav}`,
        borderRadius: '5px'
      }}
    >
      {messages.map((message, index) => (
        <Typography key={index} variant="body2" sx={{ fontSize: '14px' }}>
          {message}
        </Typography>
      ))}
    </Box>
  )
}

DisclaimerBanner.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.string).isRequired
}

export default DisclaimerBanner
