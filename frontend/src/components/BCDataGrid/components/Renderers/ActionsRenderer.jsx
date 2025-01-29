import { IconButton, Tooltip, Stack } from '@mui/material'
import {
  Edit,
  Delete,
  Save,
  Cancel,
  Queue,
  Warning,
  DoneAll
} from '@mui/icons-material'

export const ActionsRenderer = ({ onDuplicate, onDelete, ...props }) => {
  const isCurrentRowEditing = props.api
    .getEditingCells()
    .some((cell) => cell.rowIndex === props.node.rowIndex)

  return (
    <Stack direction="row" spacing={0.1} m={0}>
      {props.enableDuplicate && (
        <Tooltip title="duplicate">
          <IconButton
            aria-label="copy the data to new row"
            data-testid="duplicate-button"
            color="primary"
            onClick={() => {
              onDuplicate(props)
            }}
          >
            <Queue
              sx={{
                transform: 'scaleX(-1)'
              }}
            />
          </IconButton>
        </Tooltip>
      )}
      {!props.data.isValid && props.data.modified && (
        <Tooltip title={props.data.validationMsg}>
          <IconButton
            aria-label="shows sign for validation"
            data-testid="validation-sign"
          >
            <Warning color="error" />
          </IconButton>
        </Tooltip>
      )}
      {props.data.isValid && isCurrentRowEditing && props.data.modified && (
        <Tooltip title={'validation success'}>
          <IconButton
            aria-label="shows sign for validation"
            data-testid="validation-sign"
          >
            <DoneAll color="success" />
          </IconButton>
        </Tooltip>
      )}
      {props.enableEdit && !isCurrentRowEditing && (
        <Tooltip title="Edit">
          <IconButton
            aria-label="edit row"
            data-testid="edit-button"
            color="primary"
            onClick={() => {
              return props.api.startEditingCell({
                rowIndex: props.node.rowIndex,
                colKey: props.api.getDisplayedCenterColumns()[2].colId
              })
            }}
          >
            <Edit />
          </IconButton>
        </Tooltip>
      )}
      {props.enableDelete && !isCurrentRowEditing && (
        <Tooltip title="Delete">
          <IconButton
            aria-label="delete row"
            data-testid="delete-button"
            color="error"
            onClick={() => {
              onDelete(props)
            }}
          >
            <Delete />
          </IconButton>
        </Tooltip>
      )}
      {props.enableEdit && isCurrentRowEditing && (
        <Tooltip title="Save">
          <IconButton
            aria-label="save modified data"
            data-testid="save-button"
            color="success"
            onClick={() => {
              props.api.stopEditing(false)
            }}
          >
            <Save />
          </IconButton>
        </Tooltip>
      )}
      {props.enableEdit && isCurrentRowEditing && (
        <Tooltip title="Cancel">
          <IconButton
            aria-label="cancel modification"
            data-testid="cancel-button"
            color="error"
            onClick={() => {
              props.api.stopEditing(true)
            }}
          >
            <Cancel />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  )
}
ActionsRenderer.displayName = 'ActionsRenderer'
