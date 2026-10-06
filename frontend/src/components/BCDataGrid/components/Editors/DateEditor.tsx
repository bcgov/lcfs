import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { format, isValid, parseISO } from 'date-fns'
import { useEffect, useRef, useState } from 'react'
import type {
  ComponentProps,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  SyntheticEvent
} from 'react'

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
    restoreWindowScroll(scrollX, scrollY, () => {
      if (rowIndex !== undefined && colId) {
        api?.setFocusedCell?.(rowIndex, colId)
      }
    })
  }, 0)
}

const restoreWindowScroll = (
  scrollX: number,
  scrollY: number,
  callback?: () => void
) => {
  let hasRunCallback = false
  const restore = () => {
    if (!hasRunCallback) {
      callback?.()
      hasRunCallback = true
    }
    window.scrollTo(scrollX, scrollY)
  }

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      restore()
      setTimeout(restore, 0)
    })
    return
  }

  setTimeout(restore, 0)
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

const legacyDatePickerProps = {
  fullWidth: true,
  margin: 'normal',
  id: 'date-picker-dialog',
  variant: 'inline',
  disableToolbar: true
} as unknown as ComponentProps<typeof DatePicker>

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
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    parseDateValue(value)
  )
  const [isOpen, setIsOpen] = useState(() => {
    if (!autoOpenLastRow) return false
    const lastRowIndex = api?.getLastDisplayedRowIndex?.() ?? -1
    return rowIndex === lastRowIndex
  })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const initialValueRef = useRef<string | null>(
    formatDateValue(parseDateValue(value))
  )
  const hasCommittedRef = useRef(false)

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      const target = event.target
      const isPickerPopperClick =
        target instanceof Element && target.closest('.MuiPickersPopper-root')
      if (
        containerRef.current &&
        !(target instanceof Node && containerRef.current.contains(target)) &&
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

  const updateValue = (val: Date | null) => {
    setSelectedDate(normalizeDate(val))
  }

  const commitValue = (val: Date | null = selectedDate) => {
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

  const handleDatePickerViewChange = () => {
    restoreWindowScroll(window.scrollX, window.scrollY)
  }

  // Improved event handlers for better cross-browser support
  const stopPropagation = (e: SyntheticEvent<HTMLElement>) => {
    if (e && e.stopPropagation) {
      e.stopPropagation()
    }
    return false
  }

  // Handler for the icon click that forces the calendar to open
  const handleIconClick = (e: MouseEvent<HTMLElement>) => {
    stopPropagation(e)
    if (e && e.preventDefault) {
      e.preventDefault()
    }
    setIsOpen(true)
  }

  // Explicit handler for clearing the date
  const handleClear = (e: MouseEvent<HTMLElement>) => {
    stopPropagation(e)
    setSelectedDate(null)
    onValueChange(null)
    stopEditingAfterValueChange(api, rowIndex, column)
  }

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
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
        {...legacyDatePickerProps}
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
        onViewChange={handleDatePickerViewChange}
        open={isOpen}
        onOpen={handleDatePickerOpen}
        onClose={handleDatePickerClose}
        views={['year', 'month', 'day']}
        minDate={minDate as unknown as Date | undefined}
        maxDate={maxDate as unknown as Date | undefined}
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
