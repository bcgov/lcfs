import { IconButton, Tooltip, Stack } from '@mui/material'
import { Delete, Queue } from '@mui/icons-material'
import { v4 as uuid } from 'uuid'
import { useSaveFuelCode } from '@/hooks/useFuelCode'

export const FuelCodeActions = ({ api, node, data, onValidated }) => {
  const { mutate: saveRow } = useSaveFuelCode()

  const duplicateRow = () => {
    const rowData = {
      ...data,
      id: uuid(),
      fuelCodeId: null,
      modified: true
    }
    if (api) {
      // Add new row to grid
      api.applyTransaction({
        add: [rowData],
        addIndex: node?.rowIndex + 1,
      })
      // Only save to db if original row was validated
      if(data.fuelCodeId) {
        saveRow(rowData, {
          onSuccess: () => {
            rowData.modified = false
            api.refreshCells()
            if (onValidated) {
              onValidated('success', 'Row duplicated successfully.')
            }
          },
          onError: (error) => {
            console.error('Error duplicating row:', error)
            if (onValidated) {
              console.log(error)
              onValidated('error', `Error duplicating row: ${error.message}`)
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
    const updatedRow = { ...data, deleted: true }
    if (api) {
      api.applyTransaction({ remove: [node.data] })
      if(updatedRow.fuelCodeId) {
        saveRow(updatedRow, {
          onSuccess: () => {
            if (onValidated) {
              onValidated('success', 'Row deleted successfully.')
            }
          },
          onError: (error) => {
            console.error('Error deleting row:', error)
            if (onValidated) {
              console.log(error)
              onValidated('error', `Error deleting row: ${error.message}`)
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
FuelCodeActions.displayName = 'FuelCodeActions'
