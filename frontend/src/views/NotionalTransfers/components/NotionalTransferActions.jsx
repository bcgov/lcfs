import { IconButton, Tooltip, Stack } from '@mui/material'
import { Delete, Queue, Warning, DoneAll } from '@mui/icons-material'
import { v4 as uuid } from 'uuid'
import { useSaveNotionalTransfer } from '@/hooks/useNotionalTransfer'

export const NotionalTransferActions = ({ api, node, data, onValidated }) => {
  const { mutate: saveRow } = useSaveNotionalTransfer()

  const duplicateRow = () => {
    const rowData = {
      ...data,
      id: uuid(),
      notionalTransferId: null,
      modified: true
    }
    if (api) {
      // Add new row to grid
      api.applyTransaction({
        add: [rowData],
        addIndex: node?.rowIndex + 1,
      })
      // Only save to db if original row was validated
      if(data.notionalTransferId) {
        saveRow(rowData, {
          onSuccess: () => {
            rowData.modified = false
            api.refreshCells()
            if (onValidated) {
              onValidated('success', 'Row duplicated successfully.')
            }
          },
          onError: (error) => {
            console.error('Error duplicated row:', error)
            if (onValidated) {
              onValidated('error', error, api)
            }
          }
        })
      }
    } else {
      console.error('API is undefined')
    }
  }

  const deleteRow = () => {
    console.log("ACTION - deleteRow", api)
    const updatedRow = { ...data, deleted: true, modified: undefined }
    if (api) {
      api.applyTransaction({ remove: [node.data] })
      if(updatedRow.notionalTransferId) {
        saveRow(updatedRow, {
          onSuccess: () => {
            if (onValidated) {
              onValidated('success', 'Row deleted successfully.')
            }
          },
          onError: (error) => {
            console.error('Error deleting row:', error)
            if (onValidated) {
              onValidated(onValidated('error', error, api))
            }
          }
        })
      }
    } else {
      console.error('API is undefined')
    }
  }

  return (
    <Stack direction="row" spacing={0.1} m={0}>
      <Tooltip title="duplicate">
        <IconButton
          aria-label="copy the data to new row"
          data-testid="duplicate-button"
          color="primary"
          onClick={() => {
            duplicateRow()
          }}
        >
          <Queue
            sx={{
              transform: 'scaleX(-1)'
            }}
          />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete">
        <IconButton
          aria-label="delete row"
          data-testid="delete-button"
          color="error"
          onClick={() => {
            deleteRow()
          }}
        >
          <Delete />
        </IconButton>
      </Tooltip>
    </Stack>
  )
}
NotionalTransferActions.displayName = 'NotionalTransferActions'
