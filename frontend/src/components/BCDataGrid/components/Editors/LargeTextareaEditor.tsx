import { forwardRef, useState, useCallback, useLayoutEffect } from 'react'
import InputBase from '@mui/material/InputBase'
import Popper from '@mui/material/Popper'
import Paper from '@mui/material/Paper'
import type { GridApi } from 'ag-grid-community'

export interface LargeTextareaEditorProps {
  value?: string
  onValueChange: (value: string) => void
  column: { actualWidth: number }
  api?: Pick<GridApi, 'getFocusedCell' | 'tabToNextCell'>
  [key: string]: unknown
}

export const LargeTextareaEditor = forwardRef(
  ({
  value,
  onValueChange,
  column,
  api
}) => {
    const [valueState, setValueState] = useState(value)
    const [anchorEl, setAnchorEl] = useState()
    const [inputRef, setInputRef] = useState(null)

    useLayoutEffect(() => {
      api?.getFocusedCell()
      if (inputRef) {
        inputRef.focus()
      }
    }, [inputRef, api])

    const handleRef = useCallback((el) => {
      setAnchorEl(el)
    }, [])

    const handleChange = useCallback(
      (event) => {
        const newValue = event.target.value
        setValueState(newValue)
        onValueChange(newValue)
      },
      [onValueChange]
    )

    const handleKeyDown = (event) => {
      if (event.key === 'Tab') {
        // setAnchorEl(null)
        // Move to the next cell
        api?.tabToNextCell()
      }
    }

    return (
      <div style={{ position: 'relative' }}>
        <div
          ref={handleRef}
          style={{
            height: 1,
            width: column.actualWidth,
            display: 'block',
            position: 'absolute',
            top: 0
          }}
        />
        {anchorEl && (
          <Popper
            open
            anchorEl={anchorEl}
            placement="top-start"
            style={{ zIndex: 1500 }}
          >
            <Paper elevation={3} sx={{ p: 1, minWidth: column.actualWidth }}>
              <InputBase
                className="ag-grid-date-editor ag-input-field"
                multiline
                rows={4}
                value={valueState}
                sx={{
                  textarea: { resize: 'both' },
                  width: '100%',
                  fontSize: '16px'
                }}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                inputRef={(ref) => setInputRef(ref)}
              />
            </Paper>
          </Popper>
        )}
      </div>
    )
  }
)

LargeTextareaEditor.displayName = 'LargeTextareaEditor'
