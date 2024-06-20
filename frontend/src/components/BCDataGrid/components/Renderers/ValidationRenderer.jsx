import { IconButton, Tooltip, Stack } from '@mui/material'
import { Warning, DoneAll } from '@mui/icons-material'

export const ValidationRenderer = ({ data }) => {
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
    </Stack>
  )
}
ValidationRenderer.displayName = 'ValidationRenderer'
