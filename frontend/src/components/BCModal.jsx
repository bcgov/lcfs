import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Box
} from '@mui/material'
import { Close, Warning } from '@mui/icons-material'
import BCButton from './BCButton'
import colors from '@/themes/base/colors'

const BCModal = ({ open, onClose, data = null }) => {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsLoading(false)
  }, [open])

  if (!data) return null

  const {
    content,
    title,
    primaryButtonText,
    primaryButtonAction,
    primaryButtonColor,
    primaryButtonDisabled,
    warningText,
    secondaryButtonText,
    secondaryButtonAction,
    secondaryButtonColor,
    customButtons
  } = data

  const handlePrimaryButtonClick = async () => {
    // Blocks repeat clicks of the button
    if (isLoading) {
      return
    }
    setIsLoading(true)
    await primaryButtonAction()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      data-test="modal"
    >
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
      {warningText && (
        <DialogContent>
          <Box
            bgcolor={colors.alerts.warning.background}
            borderRadius={1}
            p={1}
            display={'flex'}
            gap={1}
          >
            <Warning color="warning" fontSize={'medium'} />
            <div dangerouslySetInnerHTML={{ __html: warningText }} />
          </Box>
        </DialogContent>
      )}
      <DialogContent>{content}</DialogContent>
      <Divider />
      <DialogActions>
        {secondaryButtonText && (
          <BCButton
            variant="outlined"
            id={
              'modal-btn-' +
              secondaryButtonText.toLowerCase().replaceAll(' ', '-')
            }
            color={secondaryButtonColor ?? 'dark'}
            onClick={secondaryButtonAction ?? onClose}
          >
            {secondaryButtonText}
          </BCButton>
        )}
        {customButtons}
        {primaryButtonText && (
          <BCButton
            variant="contained"
            id={
              'modal-btn-' +
              primaryButtonText.toLowerCase().replaceAll(' ', '-')
            }
            color={primaryButtonColor ?? 'primary'}
            autoFocus
            onClick={handlePrimaryButtonClick}
            isLoading={isLoading}
            disabled={primaryButtonDisabled}
          >
            {primaryButtonText}
          </BCButton>
        )}
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
    primaryButtonText: PropTypes.string,
    primaryButtonAction: PropTypes.func,
    primaryButtonColor: PropTypes.string,
    warningText: PropTypes.string,
    secondaryButtonText: PropTypes.string,
    secondaryButtonAction: PropTypes.func,
    secondaryButtonColor: PropTypes.string,
    customButtons: PropTypes.node
  })
}

export default BCModal
