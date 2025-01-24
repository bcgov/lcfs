import { useState, forwardRef, useEffect, useRef, useMemo } from 'react'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { InputAdornment, TextField, IconButton } from '@mui/material'
import {
  CalendarToday,
  ArrowCircleRight,
  ArrowCircleDown
} from '@mui/icons-material'
import { PickerModal } from 'mui-daterange-picker-plus'
import { format, parse, isAfter, isBefore, isValid } from 'date-fns'
import InputMask from 'react-input-mask'
import colors from '@/themes/base/colors'

const customTheme = createTheme({
  palette: {
    primary: {
      main: colors.primary.main,
      contrastText: '#fff'
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          '&.Mui-focusVisible': {
            outline: `2px solid ${colors.primary.main}`,
            outlineOffset: '2px'
          }
        },
        containedPrimary: {
          backgroundColor: colors.primary.main,
          '&:hover': {
            backgroundColor: '#002850'
          }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '&.Mui-focused': {
            borderColor: colors.primary.main,
            borderWidth: '2px',
            boxShadow: '0 0 0 2px rgba(0, 51, 102, 0.25)'
          }
        }
      }
    },
    MuiPopover: {
      styleOverrides: {
        root: {
          zIndex: 2000, // Ensure popover is above other components
          position: 'fixed' // Prevent clipping in Safari
        },
        paper: {
          borderRadius: '16px',
          boxShadow: 'rgba(0, 0, 0, 0.21) 0px 0px 4px',
          overflow: 'visible' // Prevent content from being clipped
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            outline: '2px solid #003366',
            outlineOffset: '2px'
          }
        }
      }
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          zIndex: 1999 // Place behind the modal content
        }
      }
    }
  }
})

const modalBaseProps = {
  hideDefaultRanges: true,
  disablePortal: false,
  anchorOrigin: {
    vertical: 'bottom',
    horizontal: 'left'
  },
  slotProps: {
    paper: {
      sx: {
        borderRadius: '16px',
        boxShadow: 'rgba(0, 0, 0, 0.21) 0px 0px 4px',
        '.MuiButton-containedPrimary': {
          backgroundColor: 'primary.main',
          color: '#fff',
          '&:hover': {
            backgroundColor: 'primary.dark'
          }
        }
      }
    }
  }
}

const RangeSeparatorIcons = {
  xs: ArrowCircleDown,
  md: ArrowCircleRight
}

export const DateRangeCellEditor = forwardRef(
  ({ value, onValueChange, minDate, maxDate, api, colDef, ...props }, ref) => {
    const [anchorEl, setAnchorEl] = useState(null)
    const [error, setError] = useState(false)
    const [inputValue, setInputValue] = useState(
      Array.isArray(value) ? `${value[0]} to ${value[1]}` : ''
    )
    const textFieldRef = useRef(null)
    const calendarIconRef = useRef(null)

    useEffect(() => {
      textFieldRef.current?.focus()
      textFieldRef.current?.select()
    }, [])

    const validateDateRange = useMemo(
      () => (startDate, endDate) => {
        if (!isValid(startDate) || !isValid(endDate)) return false
        if (isAfter(startDate, endDate)) return false
        if (isBefore(startDate, minDate) || isAfter(endDate, maxDate))
          return false
        return true
      },
      [minDate, maxDate]
    )

    const handleSetDateRangeOnSubmit = ({ startDate, endDate }) => {
      const start = new Date(startDate)
      const end = new Date(endDate)

      if (validateDateRange(start, end)) {
        setAnchorEl(null)
        const formattedRange = [
          format(start, 'yyyy-MM-dd'),
          format(end, 'yyyy-MM-dd')
        ]
        setError(false)
        setInputValue(`${formattedRange[0]} to ${formattedRange[1]}`)
        onValueChange(formattedRange)
      } else {
        setError(true)
      }
    }

    const handleInputChange = (e) => {
      setInputValue(e.target.value)
      setError(false) // Clear error while editing
    }

    const handleTextFieldBlur = () => {
      const [startStr, endStr] = inputValue.split(' to ')
      if (startStr && endStr) {
        const startDate = parse(startStr, 'yyyy-MM-dd', new Date())
        const endDate = parse(endStr, 'yyyy-MM-dd', new Date())

        if (validateDateRange(startDate, endDate)) {
          const formattedRange = [
            format(startDate, 'yyyy-MM-dd'),
            format(endDate, 'yyyy-MM-dd')
          ]
          setError(false)
          setInputValue(`${formattedRange[0]} to ${formattedRange[1]}`)
          onValueChange(formattedRange)
        } else {
          setError(true)
        }
      } else {
        setError(true)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Tab') {
        if (document.activeElement === textFieldRef.current) {
          event.preventDefault()
          calendarIconRef.current?.focus()
        } else if (document.activeElement === calendarIconRef.current && api) {
          event.preventDefault()
          api.stopEditing()
          api.tabToNextCell()
          const focusedCell = api.getFocusedCell()
          if (focusedCell) {
            setTimeout(() => {
              api.startEditingCell({
                rowIndex: focusedCell.rowIndex,
                colKey: focusedCell.column.getId()
              })
            }, 0)
          }
        }
      }
    }

    const initialDateRange = useMemo(
      () => ({
        startDate:
          Array.isArray(value) && value[0]
            ? new Date(value[0] + 'T08:00:00.000Z')
            : minDate,
        endDate:
          Array.isArray(value) && value[1]
            ? new Date(value[1] + 'T08:00:00.000Z')
            : maxDate
      }),
      [value, minDate, maxDate]
    )

    return (
      <div
        className="ag-grid-date-range-selector ag-cell-not-inline-editing"
        style={{ width: colDef?.minWidth || '330px' }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        aria-label="Date range editor"
        role="group"
      >
        <InputMask
          mask="9999-99-99 to 9999-99-99"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleTextFieldBlur}
        >
          {(inputProps) => (
            <TextField
              {...inputProps}
              inputRef={textFieldRef}
              fullWidth
              margin="none"
              error={error}
              helperText={error ? 'Invalid range. Using default range' : ''}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={(e) => setAnchorEl(e.currentTarget)}
                      ref={calendarIconRef}
                      tabIndex={0}
                      aria-label="Open calendar"
                    >
                      <CalendarToday />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              inputProps={{
                'aria-label': 'Date range input',
                'aria-invalid': error,
                'aria-describedby': error ? 'date-range-error' : undefined
              }}
            />
          )}
        </InputMask>
        {error && (
          <span id="date-range-error" style={{ display: 'none' }}>
            Invalid date range
          </span>
        )}
        <ThemeProvider theme={customTheme}>
          <PickerModal
            initialDateRange={initialDateRange}
            minDate={minDate}
            maxDate={maxDate}
            {...modalBaseProps}
            customProps={{
              onSubmit: handleSetDateRangeOnSubmit,
              onCloseCallback: () => setAnchorEl(null),
              RangeSeparatorIcons
            }}
            modalProps={{
              open: Boolean(anchorEl),
              anchorEl,
              onClose: () => setAnchorEl(null)
            }}
          />
        </ThemeProvider>
      </div>
    )
  }
)

DateRangeCellEditor.displayName = 'DateRangeCellEditor'
