import {
  forwardRef,
  useState,
  useCallback,
  useLayoutEffect,
  type ChangeEvent,
  type KeyboardEvent
} from 'react'
import InputBase from '@mui/material/InputBase'
import Popper from '@mui/material/Popper'
import Paper from '@mui/material/Paper'

export interface LargeTextareaEditorProps {
  value?: string
  onValueChange: (value: string) => void
  column: { actualWidth: number }
  api?: any
}

export const LargeTextareaEditor = forwardRef<
  HTMLDivElement,
  LargeTextareaEditorProps
>(
  (
    { value, onValueChange, column, ...props }: LargeTextareaEditorProps,
    _ref
  ) => {
    const [valueState, setValueState] = useState(value)
    const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null)
    const [inputRef, setInputRef] = useState<HTMLTextAreaElement | null>(null)

    useLayoutEffect(() => {
      props.api.getFocusedCell()
      if (inputRef) {
        inputRef.focus()
      }
    }, [inputRef, props.api])

    const handleRef = useCallback((el: HTMLDivElement | null) => {
      setAnchorEl(el)
    }, [])

    const handleChange = useCallback(
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = event.target.value
        setValueState(newValue)
        onValueChange(newValue)
      },
      [onValueChange]
    )

    const handleKeyDown = (
      event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
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
