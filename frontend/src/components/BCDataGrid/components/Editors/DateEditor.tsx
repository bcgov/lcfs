// @ts-nocheck
import { DatePicker } from '@mui/x-date-pickers'
import { format, isValid, parseISO } from 'date-fns'
import { useEffect, useRef, useState } from 'react'

export interface DateEditorProps {
  value?: string | null
  onValueChange: (value: string | null) => void
  minDate?: Date | string
  maxDate?: Date | string
  rowIndex?: number
  api?: any
  column?: any
  autoOpenLastRow?: boolean
}

const stopEditingAfterValueChange = (
  api?: any,
  rowIndex?: number,
  column?: any
) => {
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const colId = column?.getColId?.() || column?.colId || column?.colDef?.field

  setTimeout(() => {
    api?.stopEditing?.()
    requestAnimationFrame(() => {
      if (rowIndex !== undefined && colId) {
        api?.setFocusedCell?.(rowIndex, colId)
      }
      window.scrollTo(scrollX, scrollY)
    })
  }, 0)
}

const parseDateValue = (dateValue?: string | Date | null) => {
  if (!dateValue || dateValue === 'YYYY-MM-DD') return null
  if (dateValue instanceof Date) return dateValue
  return parseISO(dateValue)
}

const normalizeDate = (val?: Date | null) => {
  if (!val || !isValid(val)) return null
  return new Date(val.getFullYear(), val.getMonth(), val.getDate())
}

const formatDateValue = (val?: Date | null) => {
  const normalizedDate = normalizeDate(val)
  return normalizedDate ? format(normalizedDate, 'yyyy-MM-dd') : null
}

export const DateEditor = ({
  value,
  onValueChange,
  minDate,
  maxDate,
  rowIndex,
  api,
  column,
  autoOpenLastRow
}: DateEditorProps) => {
  // Handle initial value properly - use null if value is falsy
  const [selectedDate, setSelectedDate] = useState(parseDateValue(value))
  const [isOpen, setIsOpen] = useState(() => {
    if (!autoOpenLastRow) return false
    const lastRowIndex = api.getLastDisplayedRowIndex()
    return rowIndex === lastRowIndex
  })
  const containerRef = useRef(null)
  const initialValueRef = useRef(formatDateValue(parseDateValue(value)))
  const hasCommittedRef = useRef(false)

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target
      const isPickerPopperClick = target?.closest?.('.MuiPickersPopper-root')
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !isPickerPopperClick
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

  const updateValue = (val) => {
    setSelectedDate(normalizeDate(val))
  }

  const commitValue = (val = selectedDate) => {
    if (val === null || val === undefined) {
      if (initialValueRef.current === null) return
      setSelectedDate(null)
      onValueChange(null)
      hasCommittedRef.current = true
      stopEditingAfterValueChange(api, rowIndex, column)
      return
    }

    const normalizedDate = normalizeDate(val)
    if (!normalizedDate) return

    const formattedValue = format(normalizedDate, 'yyyy-MM-dd')
    if (formattedValue === initialValueRef.current) return

    setSelectedDate(normalizedDate)
    onValueChange(formattedValue)
    hasCommittedRef.current = true
    stopEditingAfterValueChange(api, rowIndex, column)
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
    return false
  }

  // Handler for the icon click that forces the calendar to open
  const handleIconClick = (e) => {
    stopPropagation(e)
    if (e && e.preventDefault) {
      e.preventDefault()
    }
    setIsOpen(true)
  }

  // Explicit handler for clearing the date
  const handleClear = (e) => {
    stopPropagation(e)
    setSelectedDate(null)
    onValueChange(null)
    stopEditingAfterValueChange(api, rowIndex, column)
  }

  const handleKeyDown = (e) => {
    stopPropagation(e)
    if (e?.key === 'Enter') {
      e.preventDefault?.()
      commitValue()
    }
    if (e?.key === 'Tab') {
      commitValue()
    }
  }

  const handleBlur = () => {
    if (!hasCommittedRef.current) {
      commitValue()
    }
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
            onKeyDown: handleKeyDown,
            onBlur: handleBlur,
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
          textField: {
            placeholder: 'yyyy-mm-dd',
            onKeyDown: handleKeyDown,
            onBlur: handleBlur,
            inputProps: {
              inputMode: 'numeric',
              'aria-label': 'Date in yyyy-mm-dd format'
            }
          },
          popper: {
            placement: 'bottom-start',
            onMouseDown: stopPropagation,
            onClick: stopPropagation,
            modifiers: [
              {
                name: 'preventOverflow',
                options: {
                  boundary: document.body
                }
              }
            ]
          },
          desktopTrapFocus: {
            disableRestoreFocus: true
          },
          // Handle icon click specifically to open the calendar
          openPickerButton: { onClick: handleIconClick },
          // Explicitly handle the clear button
          clearButton: { onClick: handleClear }
        }}
        value={selectedDate}
        onChange={updateValue}
        onAccept={commitValue}
        open={isOpen}
        onOpen={handleDatePickerOpen}
        onClose={handleDatePickerClose}
        views={['year', 'month', 'day']}
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
