import { useState, forwardRef } from 'react'
import { format } from 'date-fns'
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3'

export const DateEditor = forwardRef(
  ({ value, onValueChange, eventKey, rowIndex, column, ...props }, ref) => {
    const [selectedDate, setSelectedDate] = useState(new Date(value))

    const updateValue = (val) => {
      if (val) {
        val.setHours(0, 0, 0, 0)
      }
      setSelectedDate(val)
      onValueChange(format(val, 'yyyy-MM-dd'))
    }

    return (
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          style={{ width: '100%', margin: 0, padding: '6px 10px' }}
          margin="normal"
          id="date-picker-dialog"
          format="yyyy-MM-dd"
          value={selectedDate}
          onChange={updateValue}
          variant="inline"
          disableToolbar
          placeholder={'Enter ' + column.colId}
        />
      </LocalizationProvider>
    )
  }
)

DateEditor.displayName = 'DateEditor'
