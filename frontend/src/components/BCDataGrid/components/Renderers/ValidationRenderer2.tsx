// @ts-nocheck
import { DoneAll, Warning } from '@mui/icons-material'
import { Icon, Tooltip } from '@mui/material'
import CircularProgress from '@mui/material/CircularProgress'

export interface ValidationRenderer2Props {
  data: {
    validationStatus?: 'warning' | 'error' | 'success' | 'pending' | string
    validationMsg?: string
    [key: string]: any
  }
}

export const ValidationRenderer2 = ({ data }: ValidationRenderer2Props) => {
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
      return (
        <Tooltip title={data.validationMsg || 'validation error'}>
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
