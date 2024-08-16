import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3'
import { format } from 'date-fns'
import { useState } from 'react'

export const DateEditor = ({ value, onValueChange, minDate, maxDate }) => {
  const [selectedDate, setSelectedDate] = useState(
    value ? new Date(value) : null
  )

  const updateValue = (val) => {
    if (val) {
      val.setHours(0, 0, 0, 0)
    }
    setSelectedDate(val)
    onValueChange(val === null ? null : format(val, 'yyyy-MM-dd'))
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
          field: { clearable: true }
        }}
        value={selectedDate}
        onChange={updateValue}
        variant="inline"
        disableToolbar
        minDate={minDate}
        maxDate={maxDate}
      />
    </LocalizationProvider>
  )
}
