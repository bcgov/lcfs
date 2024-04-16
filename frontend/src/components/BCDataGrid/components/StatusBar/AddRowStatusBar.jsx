import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'

import BCButton from '@/components/BCButton'

export const AddRowStatusBar = (props) => {
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    props.api.addEventListener('rowEditingStarted', onRowEditingStarted)
    props.api.addEventListener('rowEditingStopped', onRowEditingStopped)

    return () => {
      props.api.removeEventListener('rowEditingStarted', onRowEditingStarted)
      props.api.removeEventListener('rowEditingStopped', onRowEditingStopped)
    }
  }, [])

  function onRowEditingStarted() {
    setEditing(true)
  }

  function onRowEditingStopped() {
    setEditing(false)
  }

  function addRow() {
    const id = uuid()
    const emptyRow = { id }
    props.api.updateRowData({ add: [emptyRow] })
    const node = props.api.getRowNode(id)
    props.api.ensureIndexVisible(node.rowIndex)

    setTimeout(() => {
      props.api.startEditingCell({
        rowIndex: node.rowIndex,
        colKey: props.columnApi.getAllColumns()[0].colId
      })
    }, 300)
  }

  return (
    <div className="add-btn-container">
      <BCButton
        variant={editing ? 'outlined' : 'contained'}
        color="primary"
        onClick={addRow}
        disabled={editing}
      >
        Add Row
      </BCButton>
    </div>
  )
}

AddRowStatusBar.displayName = 'AddRowStatusBar'
