import { Typography } from '@mui/material'
import PropType from 'prop-types'

export const CheckboxLabel = ({ header, text }) => (
  <Typography variant="body4" component="span">
    <strong>{header}</strong> —&nbsp;{text}
  </Typography>
)

CheckboxLabel.propTypes = {
  header: PropType.string.isRequired,
  text: PropType.string.isRequired
}
