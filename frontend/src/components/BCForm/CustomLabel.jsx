import BCTypography from '@/components/BCTypography'
import PropType from 'prop-types'

export const CustomLabel = ({ header, text }) => (
  <BCTypography variant="body4" component="span">
    <strong>{header}</strong> —&nbsp;{text}
  </BCTypography>
)

CustomLabel.propTypes = {
  header: PropType.string.isRequired,
  text: PropType.string.isRequired
}
