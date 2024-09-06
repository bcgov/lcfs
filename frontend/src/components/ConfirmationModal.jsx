import PropTypes from 'prop-types'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle
} from '@mui/material'
import BCButton from '@/components/BCButton/index.jsx'

const ConfirmationModal = ({
  open,
  className,
  confirmText,
  cancelLabel,
  confirmLabel,
  onClose,
  onConfirm,
  title
}) => (
  <Dialog className={className} open={open}>
    {title && <DialogTitle>{title}</DialogTitle>}
    <DialogContent>{confirmText}</DialogContent>
    <DialogActions>
      <BCButton variant="contained" color="primary" autoFocus onClick={onClose}>
        {cancelLabel}
      </BCButton>
      <BCButton variant="outlined" color="primary" onClick={onConfirm}>
        {confirmLabel}
      </BCButton>
    </DialogActions>
  </Dialog>
)

ConfirmationModal.defaultProps = {
  cancelLabel: 'Cancel',
  className: '',
  confirmLabel: 'Confirm',
  onConfirm: null,
  title: 'Confirmation'
}

ConfirmationModal.propTypes = {
  title: PropTypes.string,
  open: PropTypes.bool.isRequired,
  className: PropTypes.string,
  confirmText: PropTypes.string,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func
}

export default ConfirmationModal
