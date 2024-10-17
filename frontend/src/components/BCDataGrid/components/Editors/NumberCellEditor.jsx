import {
  formatNumberWithCommas,
  formatNumberWithoutCommas
} from '@/utils/formatters'
import { Input } from '@mui/material'
import { forwardRef } from 'react'

export const NumberCellEditor = forwardRef(
  ({ value, onValueChange, stopEditing }, ref) => {
    return (
      <Input
        ref={ref}
        value={formatNumberWithCommas(value)}
        onChange={(e) =>
          onValueChange(formatNumberWithoutCommas(e.target.value))
        }
        onBlur={() => stopEditing()}
        disableUnderline
        style={{
          width: '100%',
          height: '100%',
          padding: 8
        }}
      />
    )
  }
)

NumberCellEditor.displayName = 'NumberCellEditor'
