import { IconButton, Tooltip, Stack } from '@mui/material'
import { Edit, Delete, Save, Cancel, Queue } from '@mui/icons-material'

export const ActionsRenderer2 = (props) => {
  console.log(props)
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
            data-action="duplicate"
            color="primary"
            disabled={props.data.validationStatus !== 'success'}
          >
            <Queue
              style={{ pointerEvents: 'none' }}
              sx={{
                transform: 'scaleX(-1)'
              }}
            />
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
            data-action="delete"
            color="error"
          >
            <Delete style={{ pointerEvents: 'none' }} />
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
