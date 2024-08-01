import { DoneAll, Warning } from '@mui/icons-material'
import { IconButton, Tooltip } from '@mui/material'
import CircularProgress from '@mui/material/CircularProgress'

export const ValidationRenderer2 = ({ data }) => {
  switch (data.validationStatus) {
    case 'error':
      return (
        <Tooltip title={'validation error'}>
          <IconButton
            aria-label="shows sign for validation"
            data-testid="validation-sign"
            size="medium"
          >
            <Warning color="error" />
          </IconButton>
        </Tooltip>
      )
    case 'success':
      return (
        <Tooltip title={'validation success'}>
          <IconButton
            aria-label="shows sign for validation"
            data-testid="validation-sign"
            size="medium"
          >
            <DoneAll color="success" />
          </IconButton>
        </Tooltip>
      )
    case 'pending':
      return (
        <Tooltip title={'validating'}>
          <CircularProgress size={24} />
        </Tooltip>
      )
    default:
      return null
  }
}
