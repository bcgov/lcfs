import QueueIcon from '@mui/icons-material/Queue'
import IconButton from '@mui/material/IconButton'
import { v4 as uuid } from 'uuid'
import { useCallback } from 'react'

export const ActionsRenderer = (props) => {
  const duplicateRow = useCallback(() => {
    const selectedRows = props.api.getSelectedRows()[0]
    selectedRows.id = uuid()
    props.api.applyTransaction({ add: [selectedRows] })
  })

  return (
    <div>
      <IconButton aria-label="duplicate" color="primary" onClick={duplicateRow}>
        <QueueIcon
          sx={{
            transform: 'scaleX(-1)'
          }}
        />
      </IconButton>
    </div>
  )
}
ActionsRenderer.displayName = 'ActionsRenderer'
