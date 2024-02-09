import PropTypes from 'prop-types'
import { Box, Typography } from '@mui/material'
import colors from '@/themes/base/colors'

const DisclaimerBanner = ({ messages }) => {
  return (
    <Box
      sx={{
        backgroundColor: colors.background.grey,
        color: colors.text.primary,
        marginY: 2,
        padding: 2,
        fontSize: '14px',
        border: `1px solid ${colors.borderDivider.nav}`
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
