import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3'
import { format, parseISO } from 'date-fns'
import { useState, useEffect, useRef } from 'react'

export const DateEditor = ({ value, onValueChange, minDate, maxDate }) => {
  const [selectedDate, setSelectedDate] = useState(
    value ? parseISO(value) : null
  )
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const updateValue = (val) => {
    if (val) {
      val = new Date(val.getFullYear(), val.getMonth(), val.getDate())
    }
    setSelectedDate(val)
    onValueChange(val === null ? null : format(val, 'yyyy-MM-dd'))
  }

  const handleDatePickerOpen = () => {
    setIsOpen(true)
  }

  const handleDatePickerClose = () => {
    setIsOpen(false)
  }

  const stopPropagation = (e) => {
    e.stopPropagation()
  }

  return (
    <div ref={containerRef} onMouseDown={stopPropagation} onClick={stopPropagation}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          className="ag-grid-date-editor ag-input-field"
          fullWidth
          margin="normal"
          id="date-picker-dialog"
          format="yyyy-MM-dd"
          slotProps={{
            field: { clearable: true },
            popper: { placement: 'bottom-start' }
          }}
          value={selectedDate}
          onChange={updateValue}
          open={isOpen}
          onOpen={handleDatePickerOpen}
          onClose={handleDatePickerClose}
          variant="inline"
          disableToolbar
          minDate={minDate}
          maxDate={maxDate}
        />
      </LocalizationProvider>
    </div>
  )
}