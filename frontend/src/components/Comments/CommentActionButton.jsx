import PropTypes from 'prop-types'
import BCButton from '@/components/BCButton'

const CommentActionButton = ({ children, color = 'primary', ...props }) => (
  <BCButton
    {...props}
    type="button"
    variant="outlined"
    size="small"
    color={color}
    sx={{
      height: 'auto',
      minHeight: 26,
      minWidth: 'auto',
      py: 0.25,
      px: 1.5,
      fontSize: '0.8125rem',
      lineHeight: 1.4
    }}
  >
    {children}
  </BCButton>
)

CommentActionButton.propTypes = {
  children: PropTypes.node.isRequired,
  color: PropTypes.oneOf(['primary', 'error'])
}

export default CommentActionButton
