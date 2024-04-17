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
        marginBottom: 7,
        padding: '15px 20px',
        fontSize: '14px',
        border: `1px solid ${colors.borderDivider.nav}`,
        borderRadius: '6px'
      }}
    >
      {messages.map((message, index) => (
        <Typography key={index} variant="body2">
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
