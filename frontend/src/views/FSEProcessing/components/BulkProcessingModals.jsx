import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  CircularProgress
} from '@mui/material'
import { useTranslation } from 'react-i18next'

export const BulkProcessingModals = ({
  showValidateModal,
  showReturnToDraftModal,
  selectedCount,
  onValidateConfirm,
  onReturnToDraftConfirm,
  onValidateCancel,
  onReturnToDraftCancel,
  isValidating,
  isReturningToDraft
}) => {
  const { t } = useTranslation(['common', 'chargingEquipment'])

  return (
    <>
      {/* Validate Modal */}
      <Dialog
        open={showValidateModal}
        onClose={onValidateCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Validate Equipment</DialogTitle>
        <DialogContent>
          <Box py={2}>
            <BCTypography variant="body1" gutterBottom>
              Are you sure you want to validate {selectedCount} selected equipment?
            </BCTypography>
            <BCTypography variant="body2" color="text.secondary">
              This will change the status from Submitted to Validated for all
              eligible equipment.
            </BCTypography>
          </Box>
        </DialogContent>
        <DialogActions>
          <BCButton
            variant="outlined"
            onClick={onValidateCancel}
            disabled={isValidating}
          >
            Cancel
          </BCButton>
          <BCButton
            variant="contained"
            color="success"
            onClick={onValidateConfirm}
            disabled={isValidating}
            startIcon={
              isValidating ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {isValidating ? 'Validating...' : 'Validate Equipment'}
          </BCButton>
        </DialogActions>
      </Dialog>

      {/* Return to Draft Modal */}
      <Dialog
        open={showReturnToDraftModal}
        onClose={onReturnToDraftCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Return to Draft</DialogTitle>
        <DialogContent>
          <Box py={2}>
            <BCTypography variant="body1" gutterBottom>
              Are you sure you want to return {selectedCount} selected equipment
              to draft status?
            </BCTypography>
            <BCTypography variant="body2" color="text.secondary">
              This will allow suppliers to make further changes to the equipment.
              Status will change from Submitted/Validated to Draft.
            </BCTypography>
          </Box>
        </DialogContent>
        <DialogActions>
          <BCButton
            variant="outlined"
            onClick={onReturnToDraftCancel}
            disabled={isReturningToDraft}
          >
            Cancel
          </BCButton>
          <BCButton
            variant="contained"
            color="warning"
            onClick={onReturnToDraftConfirm}
            disabled={isReturningToDraft}
            startIcon={
              isReturningToDraft ? (
                <CircularProgress size={16} color="inherit" />
              ) : null
            }
          >
            {isReturningToDraft ? 'Returning...' : 'Return to Draft'}
          </BCButton>
        </DialogActions>
      </Dialog>
    </>
  )
}