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
  autoOpenLastRow,
  onBlur
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
    if (isOpen) {
      onBlur()
    }
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

  // Handler for the icon click that forces the calendar to open
  const handleIconClick = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setIsOpen(true)
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={stopPropagation}
      onClick={stopPropagation}
      className="date-picker-container"
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      <DatePicker
        className="ag-grid-date-editor ag-input-field"
        fullWidth
        margin="normal"
        id="date-picker-dialog"
        format="yyyy-MM-dd"
        slotProps={{
          field: {
            clearable: true,
            sx: {
              width: '100%',
              '& .MuiInputBase-root': {
                width: '100%',
                height: '100%'
              },
              '& .MuiOutlinedInput-notchedOutline': {
                border: 'none'
              }
            }
          },
          popper: {
            placement: 'bottom-start'
          },
          // Handle icon click specifically to open the calendar
          openPickerButton: {
            onClick: handleIconClick
          }
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
        sx={{
          width: '100%',
          height: '100%',
          '& .MuiInputBase-root': {
            padding: '0 5px',
            width: '100%'
          }
        }}
      />
    </div>
  )
}
