import { Typography } from '@mui/material'
import PropType from 'prop-types'

export const CustomLabel = ({ header, text }) => (
  <Typography variant="body4" component="span">
    <strong>{header}</strong> —&nbsp;{text}
  </Typography>
)

CustomLabel.propTypes = {
  header: PropType.string.isRequired,
  text: PropType.string.isRequired
}
