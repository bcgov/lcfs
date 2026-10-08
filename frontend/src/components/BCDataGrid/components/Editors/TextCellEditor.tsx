import { forwardRef, useEffect, useRef, type ChangeEvent } from 'react'
import TextField from '@mui/material/TextField'
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
}

export const TextCellEditor = forwardRef<HTMLDivElement, TextCellEditorProps>(
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
    const handleTextFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
      onValueChange(event.target.value)
    }

    const inputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
      if (inputRef) {
        inputRef.current?.focus()
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
