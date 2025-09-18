import { DoneAll, Warning } from '@mui/icons-material'
import { Icon, Tooltip } from '@mui/material'
import CircularProgress from '@mui/material/CircularProgress'

export const ValidationRenderer2 = ({ data }) => {
  switch (data.validationStatus) {
    case 'warning':
      return (
        <Tooltip title="validation warning">
          <Icon
            aria-label="shows sign for validation"
            data-testid="validation-sign"
            size="medium"
          >
            <Warning htmlColor="#fcba19" />
          </Icon>
        </Tooltip>
      )
    case 'error':
      // Build error message from validation errors if available
      let errorMessage = data.validationMsg || 'validation error'
      if (data.validationErrors && Array.isArray(data.validationErrors)) {
        const errorMessages = data.validationErrors.map(err => {
          if (err.field && err.message) {
            return `${err.field}: ${err.message}`
          }
          return err.message || err
        })
        if (errorMessages.length > 0) {
          errorMessage = errorMessages.join('; ')
        }
      }
      
      return (
        <Tooltip title={errorMessage}>
          <Icon
            aria-label="shows sign for validation"
            data-testid="validation-sign"
            size="medium"
          >
            <Warning color="error" />
          </Icon>
        </Tooltip>
      )
    case 'success':
      return (
        <Tooltip title="validation success">
          <Icon
            aria-label="shows sign for validation"
            data-testid="validation-sign"
            size="medium"
          >
            <DoneAll color="success" />
          </Icon>
        </Tooltip>
      )
    case 'pending':
      return (
        <Tooltip title="validating">
          <CircularProgress size={24} />
        </Tooltip>
      )
    default:
      return null
  }
}
