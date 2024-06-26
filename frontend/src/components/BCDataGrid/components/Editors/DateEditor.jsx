import { useState, forwardRef } from 'react'
import { format } from 'date-fns'
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3'

export const DateEditor = forwardRef(
  ({ value, onValueChange, eventKey, rowIndex, column, ...props }, ref) => {
    const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : undefined)

    const updateValue = (val) => {
      if (val) {
        val.setHours(0, 0, 0, 0)
      }
      setSelectedDate(val)
      onValueChange(val === null ? undefined : format(val, 'yyyy-MM-dd'))
    }

    return (
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          className="ag-grid-date-editor ag-input-field"
          fullWidth
          margin="normal"
          id="date-picker-dialog"
          format="yyyy-MM-dd"
          slotProps={{
            field: { clearable: true },
          }}
          value={selectedDate}
          onChange={updateValue}
          variant="inline"
          disableToolbar
          minDate={props.minDate}
          maxDate={props.maxDate}
        />
      </LocalizationProvider>
    )
  }
)

DateEditor.displayName = 'DateEditor'
