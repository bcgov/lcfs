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
  // Handle initial value properly - use null if value is falsy
  const [selectedDate, setSelectedDate] = useState(
    value && value !== 'YYYY-MM-DD' ? parseISO(value) : null
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

    // Use the more cross-browser compatible approach
    document.addEventListener('mousedown', handleClickOutside, {
      passive: true
    })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Fixed updateValue function to handle null values properly
  const updateValue = (val) => {
    // If val is null or undefined, set it as null explicitly
    if (val === null || val === undefined) {
      setSelectedDate(null)
      onValueChange(null)
      return
    }

    // Normalize the date to avoid timezone issues (common cross-browser problem)
    const normalizedDate = new Date(
      val.getFullYear(),
      val.getMonth(),
      val.getDate()
    )
    setSelectedDate(normalizedDate)
    onValueChange(format(normalizedDate, 'yyyy-MM-dd'))
  }

  const handleDatePickerOpen = () => {
    setIsOpen(true)
  }

  const handleDatePickerClose = () => {
    setIsOpen(false)
  }

  // Improved event handlers for better cross-browser support
  const stopPropagation = (e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation()
    }
    if (e && e.preventDefault) {
      e.preventDefault()
    }
    return false
  }

  // Handler for the icon click that forces the calendar to open
  const handleIconClick = (e) => {
    stopPropagation(e)
    setIsOpen(true)
  }

  // Explicit handler for clearing the date
  const handleClear = () => {
    setSelectedDate(null)
    onValueChange(null)
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
        bottom: 0,
        zIndex: isOpen ? 1000 : 'auto'
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
            onClear: handleClear,
            sx: {
              width: '100%',
              '& .MuiInputBase-root': {
                width: '100%',
                height: '100%'
              },
              '& .MuiOutlinedInput-notchedOutline': {
                border: 'none'
              },
              '& .MuiIconButton-root': {
                padding: '2px',
                touchAction: 'manipulation'
              }
            }
          },
          popper: {
            placement: 'bottom-start',
            modifiers: [
              {
                name: 'preventOverflow',
                options: {
                  boundary: document.body
                }
              }
            ]
          },
          // Handle icon click specifically to open the calendar
          openPickerButton: { onClick: handleIconClick },
          // Explicitly handle the clear button
          clearButton: { onClick: handleClear }
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
          },
          '& .MuiButtonBase-root': {
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            KhtmlUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            userSelect: 'none'
          }
        }}
      />
    </div>
  )
}
