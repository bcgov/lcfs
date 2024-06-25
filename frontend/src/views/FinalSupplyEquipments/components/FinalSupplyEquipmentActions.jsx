import { IconButton, Tooltip, Stack } from '@mui/material'
import { Delete, Queue, Warning, DoneAll } from '@mui/icons-material'
import { v4 as uuid } from 'uuid'
import { useSaveFinalSupplyEquipment } from '@/hooks/useFinalSupplyEquipment'

export const FinalSupplyEquipmentActions = ({ api, node, data, onValidated }) => {
  const { mutate: saveRow } = useSaveFinalSupplyEquipment()

  const duplicateRow = () => {
    const rowData = {
      ...data,
      id: uuid(),
      finalSupplyEquipmentId: null,
      serialNbr: undefined,
      latitude: undefined,
      longitude: undefined,
      modified: true
    }
    if (api) {
      // Add new row to grid
      api.applyTransaction({
        add: [rowData],
        addIndex: node?.rowIndex + 1,
      })
      // Only save to db if original row was validated
      if(data.finalSupplyEquipmentId) {
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
              console.log(error)
              onValidated('error', `Error duplicated row: ${error.message}`)
            }
          }
        })
      }
    } else {
      console.error('API is undefined')
    }
  }

  const deleteRow = () => {
    const updatedRow = { ...data, deleted: true }
    if (api) {
      api.applyTransaction({ remove: [node.data] })
      if(updatedRow.finalSupplyEquipmentId) {
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
FinalSupplyEquipmentActions.displayName = 'FinalSupplyEquipmentActions'