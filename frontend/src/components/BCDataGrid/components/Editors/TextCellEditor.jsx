import { forwardRef } from 'react'
import { TextField } from '@mui/material'
import InputMask from 'react-input-mask'

export const TextCellEditor = forwardRef(
  ({ value, onValueChange, eventKey, rowIndex, column, ...props }, ref) => {
    const handleTextFieldChange = (event) => {
      onValueChange(event.target.value)
    }
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
              ref={ref}
              fullWidth
              margin="0"
              InputProps={{ ...props.inputProps }}
            />
          )}
        </InputMask>
      </>
    )
  }
)

TextCellEditor.displayName = 'TextCellEditor'
