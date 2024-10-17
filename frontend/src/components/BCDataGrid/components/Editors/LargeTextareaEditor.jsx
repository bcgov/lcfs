import { forwardRef, useState, useCallback, useLayoutEffect } from 'react'
import InputBase from '@mui/material/InputBase'
import Popper from '@mui/material/Popper'
import Paper from '@mui/material/Paper'

export const LargeTextareaEditor = forwardRef(
  ({ value, onValueChange, column, ...props }, ref) => {
    const [valueState, setValueState] = useState(value)
    const [anchorEl, setAnchorEl] = useState()
    const [inputRef, setInputRef] = useState(null)

    useLayoutEffect(() => {
      const focusedCell = props.api.getFocusedCell()
      if (inputRef) {
        inputRef.focus()
      }
    }, [inputRef, props.api])

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
        props.api.tabToNextCell()
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
