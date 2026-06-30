import { IconButton, Tooltip, Stack } from '@mui/material'
import { Warning, DoneAll, Save } from '@mui/icons-material'

export interface ValidationRendererProps {
  data: {
    isValid?: boolean
    validationMsg?: string
    [key: string]: any
  }
  api?: any
  enableSave?: boolean
}

export const ValidationRenderer = ({
  data,
  ...props
}: ValidationRendererProps) => {
  return (
    <Stack direction="row" spacing={0.1} m={0}>
      {!data.isValid && (
        <Tooltip title={data.validationMsg}>
          <IconButton
            aria-label="shows sign for validation"
            data-testid="validation-sign"
          >
            <Warning color="error" />
          </IconButton>
        </Tooltip>
      )}
      {data.isValid && (
        <Tooltip title={'validation success'}>
          <IconButton
            aria-label="shows sign for validation"
            data-testid="validation-sign"
          >
            <DoneAll color="success" />
          </IconButton>
        </Tooltip>
      )}
      {props.enableSave && (
        <Tooltip title={'save'}>
          <IconButton
            aria-label="shows sign for saving"
            data-testid="save-row"
            onClick={() => props.api.stopEditing()}
          >
            <Save color="primary" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  )
}
ValidationRenderer.displayName = 'ValidationRenderer'
