// @ts-nocheck
import { forwardRef, useEffect, useRef } from 'react'
import { TextField } from '@mui/material'
import InputMask from 'react-input-mask'

export interface TextCellEditorProps {
  value?: string
  onValueChange: (value: string) => void
  eventKey?: string
  rowIndex?: number
  column?: any
  mask?: string
  formatChars?: Record<string, string>
  inputProps?: Record<string, any>
  [key: string]: any
}

export const TextCellEditor = forwardRef(
  (
    {
      value,
      onValueChange,
      eventKey,
      rowIndex,
      column,
      ...props
    }: TextCellEditorProps,
    ref
  ) => {
    const handleTextFieldChange = (event) => {
      onValueChange(event.target.value)
    }

    const inputRef = useRef(null)

    useEffect(() => {
      if (inputRef) {
        inputRef.current.focus()
      }
    }, [])

    return (
      <>
        <InputMask
          mask={props.mask}
          formatChars={props.formatChars}
          value={value}
          disabled={false}
          onChange={handleTextFieldChange}
        >
          {() => (
            <TextField
              inputRef={inputRef}
              ref={ref}
              fullWidth
              margin="none"
              InputProps={{ ...props.inputProps }}
            />
          )}
        </InputMask>
      </>
    )
  }
)

TextCellEditor.displayName = 'TextCellEditor'
