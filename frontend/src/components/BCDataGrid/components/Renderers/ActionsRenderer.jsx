import BCTypography from '@/components/BCTypography'
import { Cancel, Delete, Edit, Queue, Replay } from '@mui/icons-material'
import { Box, IconButton, Stack, Tooltip } from '@mui/material'

export const ActionsRenderer = (props) => {
  const isCurrentRowEditing = props.api
    .getEditingCells()
    .some((cell) => cell.rowIndex === props.node.rowIndex)

  return (
    <Stack direction="row" spacing={0.1} m={0} mt={0.2}>
      {props.enableDuplicate && (
        <Tooltip title="duplicate">
          <span>
            <IconButton
              aria-label="copy the data to new row"
              data-testid="duplicate-button"
              data-action="duplicate"
              color="primary"
              disabled={props.data.validationStatus === 'error'}
            >
              <Queue
                style={{ pointerEvents: 'none' }}
                sx={{
                  transform: 'scaleX(-1)'
                }}
              />
            </IconButton>
          </span>
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
      {props.enableDelete && (
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
      {props.enableUndo && (
        <Tooltip title="Undo">
          <IconButton
            aria-label="undo row"
            data-testid="undo-button"
            data-action="undo"
          >
            <Replay style={{ pointerEvents: 'none' }} />
          </IconButton>
        </Tooltip>
      )}
      {props.enableStatus && (
        <Box alignItems="center" justifyContent="center" display="flex" m={0}>
          <BCTypography variant="body2">{props.enableStatus}</BCTypography>
        </Box>
      )}
    </Stack>
  )
}
