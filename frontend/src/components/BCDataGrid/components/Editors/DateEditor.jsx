import { DatePicker } from '@mui/x-date-pickers'
import { format, parseISO } from 'date-fns'
import { useEffect, useRef, useState } from 'react'

export const DateEditor = ({
  value,
  onValueChange,
  minDate,
  maxDate,
  rowIndex,
  api,
  autoOpenLastRow
}) => {
  const [selectedDate, setSelectedDate] = useState(
    value ? parseISO(value) : null
  )
  const [isOpen, setIsOpen] = useState(() => {
    if (!autoOpenLastRow) return false
    const lastRowIndex = api.getLastDisplayedRowIndex()
    return rowIndex === lastRowIndex
  })
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
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
    <div
      ref={containerRef}
      onMouseDown={stopPropagation}
      onClick={stopPropagation}
    >
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
    </div>
  )
}
