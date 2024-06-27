import React from 'react'
import { IconButton, Tooltip, Stack } from '@mui/material'
import { Delete, Queue } from '@mui/icons-material'
import { v4 as uuid } from 'uuid'
import { useSaveOtherUses } from '@/hooks/useOtherUses'

export const OtherUsesActions = ({ api, node, data, onValidated }) => {
  const { mutate: saveRow } = useSaveOtherUses()

  const duplicateRow = () => {
    const rowData = {
      ...data,
      id: uuid(),
      otherUsesId: null,
      modified: true
    }
    if (api) {
      // Add new row to grid
      api.applyTransaction({
        add: [rowData],
        addIndex: node?.rowIndex + 1,
      })
      // Only save to db if original row was validated
      if(data.otherUsesId) {
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
    const updatedRow = { ...data, deleted: true }
    if (api) {
      api.applyTransaction({ remove: [node.data] })
      if(updatedRow.otherUsesId) {
        saveRow(updatedRow, {
          onSuccess: () => {
            if (onValidated) {
              onValidated('success', 'Row deleted successfully.')
            }
          },
          onError: (error) => {
            console.error('Error deleting row:', error)
            if (onValidated) {
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
      <Tooltip title="Duplicate">
        <IconButton
          aria-label="copy the data to new row"
          data-test="duplicate-button"
          color="primary"
          onClick={duplicateRow}
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
          data-test="delete-button"
          color="error"
          onClick={deleteRow}
        >
          <Delete />
        </IconButton>
      </Tooltip>
    </Stack>
  )
}

OtherUsesActions.displayName = 'OtherUsesActions'
