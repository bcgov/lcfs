import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from '@mui/material'
import { Close } from '@mui/icons-material'
import BCButton from './BCButton'

const BCModal = (props) => {
  const { open, onClose, data } = props
  if (!data) return null
  const {
    content,
    title,
    primaryButtonText,
    primaryButtonAction,
    primaryButtonColor,
    secondaryButtonText,
    secondaryButtonAction,
    secondaryButtonColor,
    customButtons
  } = data
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <IconButton
        aria-label="close"
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: (theme) => theme.palette.grey[500]
        }}
      >
        <Close />
      </IconButton>
      <DialogContent dividers>{content}</DialogContent>
      <DialogActions>
        <BCButton
          variant="outlined"
          color={secondaryButtonColor ?? 'dark'}
          onClick={secondaryButtonAction ?? onClose}
        >
          {secondaryButtonText}
        </BCButton>
        {customButtons}
        <BCButton
          variant="contained"
          color={primaryButtonColor ?? 'primary'}
          autoFocus
          onClick={primaryButtonAction}
        >
          {primaryButtonText}
        </BCButton>
      </DialogActions>
    </Dialog>
  )
}

BCModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  data: PropTypes.shape({
    content: PropTypes.node.isRequired,
    title: PropTypes.string.isRequired,
    primaryButtonText: PropTypes.string.isRequired,
    primaryButtonAction: PropTypes.func.isRequired,
    primaryButtonColor: PropTypes.string,
    secondaryButtonText: PropTypes.string,
    secondaryButtonAction: PropTypes.func,
    secondaryButtonColor: PropTypes.string,
    customButtons: PropTypes.node,
  }),
};

BCModal.defaultProps = {
  data: null,
};

export default BCModal

