import { IconButton, Tooltip, Stack } from '@mui/material'
import { Delete, Queue } from '@mui/icons-material'
import { v4 as uuid } from 'uuid'
import { useSaveFuelSupply } from '@/hooks/useFuelSupply'
import { useParams } from 'react-router-dom'

export const FuelSupplyActions = ({ api, node, data, onValidated }) => {
  const params = useParams()
  const { mutate: saveRow } = useSaveFuelSupply(params)

  const duplicateRow = () => {
    const rowData = {
      ...data,
      id: uuid(),
      fuelSupplyId: null,
      serialNbr: undefined,
      latitude: undefined,
      longitude: undefined,
      modified: undefined,
      isValid: false,
      validationMsg: "Fill in the missing fields"
    }
    if (api) {
      // Add new row to grid
      api.applyTransaction({
        add: [rowData],
        addIndex: node?.rowIndex + 1,
      })
      // Only save to db if original row was validated
      if(data.fuelSupplyId) {
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
    const updatedRow = { ...data, deleted: true, modified: undefined }
    if (api) {
      api.applyTransaction({ update: [updatedRow] })
      api.applyTransaction({ remove: [updatedRow] })
      if(updatedRow.fuelSupplyId) {
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
              onValidated('error', error, api)
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
FuelSupplyActions.displayName = 'FuelSupplyActions'
