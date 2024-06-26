import { IconButton, Tooltip, Stack } from '@mui/material'
import { Delete, Queue } from '@mui/icons-material'
import { v4 as uuid } from 'uuid'
import { useSaveFinalSupplyEquipment } from '@/hooks/useFinalSupplyEquipment'
import { useParams } from 'react-router-dom'

export const FinalSupplyEquipmentActions = ({ api, node, data, onValidated }) => {
  const params = useParams()
  const { mutate: saveRow } = useSaveFinalSupplyEquipment(params)

  const duplicateRow = () => {
    const rowData = {
      ...data,
      id: uuid(),
      finalSupplyEquipmentId: null,
      serialNbr: undefined,
      latitude: undefined,
      longitude: undefined,
      modified: undefined
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
          onSuccess: (response) => {
            rowData.modified = false
            api.refreshCells()
            if (onValidated) {
              onValidated('success', 'Row duplicated successfully.', api, response)
            }
          },
          onError: (error) => {
            console.error('Error duplicated row:', error)
            if (onValidated) {
              onValidated('error', error)
            }
          }
        })
      }
    } else {
      console.error('API is undefined')
    }
  }

  const deleteRow = () => {
    const updatedRow = { ...data, deleted: true, modified: undefined }
    if (api) {
      api.applyTransaction({ remove: [node.data] })
      if(updatedRow.finalSupplyEquipmentId) {
        saveRow(updatedRow, {
          onSuccess: (response) => {
            api.refreshCells()
            if (onValidated) {
              onValidated('success', 'Row deleted successfully.', api, response)
            }
          },
          onError: (error) => {
            console.error('Error deleting row:', error)
            api.refreshCells()
            if (onValidated) {
              onValidated('error', error)
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
