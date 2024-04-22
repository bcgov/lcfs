import { useState, forwardRef, useImperativeHandle } from 'react'
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

    useImperativeHandle(ref, () => {
      return {
        getValue: () => {
          let dateString = null
          if (selectedDate) {
            dateString = format(selectedDate, 'yyyy-MM-dd')
          }
          return dateString
        },
        isCancelAfterEnd: () => {
          return !selectedDate
        },
        afterGuiAttached: () => {
          if (!props.value) {
            return
          }
          const [_, day, month, year] = props.value.match(
            /(\d{2})\/(\d{2})\/(\d{4})/
          )
          const selectedDate = new Date(year, month - 1, day)
          setSelectedDate(selectedDate)
          onValueChange(selectedDate)
        }
      }
    })

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
