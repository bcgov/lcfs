import { useState, forwardRef, useEffect, useRef, useCallback } from 'react'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { InputAdornment, TextField, IconButton } from '@mui/material'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { PickerModal } from 'mui-daterange-picker-plus'
import { format, parse, isAfter, isBefore, isValid } from 'date-fns'
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight'
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown'
import InputMask from 'react-input-mask'

const customTheme = createTheme({
  palette: {
    primary: {
      main: '#003366',
      contrastText: '#fff',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          '&.Mui-focusVisible': {
            outline: '2px solid #003366',
            outlineOffset: '2px',
          },
        },
        containedPrimary: {
          backgroundColor: '#003366',
          '&:hover': {
            backgroundColor: '#002850',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '&.Mui-focused': {
            borderColor: '#003366',
            borderWidth: '2px',
            boxShadow: '0 0 0 2px rgba(0, 51, 102, 0.25)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            outline: '2px solid #003366',
            outlineOffset: '2px',
          },
        },
      },
    },
  },
})


export const DateRangeCellEditor = forwardRef(
  ({ value, onValueChange, eventKey, rowIndex, column, minDate, maxDate, api, ...props }, ref) => {
    const [anchorEl, setAnchorEl] = useState(null)
    const [error, setError] = useState(false)
    
    const textFieldRef = useRef(null)
    const calendarIconRef = useRef(null)

    useEffect(() => {
      if (textFieldRef.current) {
        textFieldRef.current.focus()
        textFieldRef.current.select()
      }
    }, [])

    const handleClick = (event) => {
      setAnchorEl(event.currentTarget)
    }

    const handleClose = () => {
      setAnchorEl(null)
    }

    const open = Boolean(anchorEl)

    const validateDateRange = (startDate, endDate) => {
      if (!isValid(startDate) || !isValid(endDate)) return false
      if (isAfter(startDate, endDate)) return false
      if (isBefore(startDate, minDate) || isAfter(endDate, maxDate)) return false
      return true
    }

    const handleSetDateRangeOnSubmit = (dateRange) => {
      const startDate = new Date(dateRange.startDate)
      const endDate = new Date(dateRange.endDate)

      if (validateDateRange(startDate, endDate)) {
        handleClose()
        const formattedRange = [
          format(startDate, 'yyyy-MM-dd'),
          format(endDate, 'yyyy-MM-dd'),
        ]
        setError(false)
        onValueChange(formattedRange)
      } else {
        setError(true)
      }
    }

    const handleTextFieldChange = (event) => {
      onValueChange(event.target.value)
    }

    const handleTextFieldBlur = (event) => {
      const inputText = event.target.value

      const dateParts = inputText.split(' to ')
      if (dateParts.length === 2) {
        const startDate = parse(dateParts[0], 'yyyy-MM-dd', new Date())
        const endDate = parse(dateParts[1], 'yyyy-MM-dd', new Date())

        if (validateDateRange(startDate, endDate)) {
          const formattedRange = [
            format(startDate, 'yyyy-MM-dd'),
            format(endDate, 'yyyy-MM-dd'),
          ]
          setError(false)
          onValueChange(formattedRange)
        } else {
          setError(true)
        }
      } else {
        setError(true)
      }
    }

    const getCurrentValue = () => {
      if (Array.isArray(value)) {
        return `${value[0]} to ${value[1]}`
      }
      return value || ''
    }

    const stopPropagation = (e) => {
      e.stopPropagation()
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Tab') {
        if (document.activeElement === textFieldRef.current) {
          event.preventDefault()
          calendarIconRef.current?.focus() // Move to calendar icon
        } else if (document.activeElement === calendarIconRef.current) {
          event.preventDefault()
          if (api) {
            api.stopEditing() // Stop editing the current cell
            // Move to the next cell and start editing
            api.tabToNextCell()
            const focusedCell = api.getFocusedCell()
            if (focusedCell) {
              setTimeout(() => {
                api.startEditingCell({
                  rowIndex: focusedCell.rowIndex,
                  colKey: focusedCell.column.getId(),
                })
              }, 0)
            }
          }
        }
      }
    }

    return (
      <div
        className="ag-grid-date-range-selector ag-cell-not-inline-editing"
        style={{ width: props.colDef.minWidth || '330px' }}
        onMouseDown={stopPropagation}
        onClick={stopPropagation}
        onKeyDown={handleKeyDown}
        aria-label="Date range editor"
        role="group"
      >
        <InputMask
          mask="9999-99-99 to 9999-99-99"
          value={getCurrentValue()}
          disabled={false}
          onChange={handleTextFieldChange}
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
                      onClick={handleClick}
                      ref={calendarIconRef}
                      tabIndex={0}
                      aria-label="Open calendar"
                    >
                      <CalendarTodayIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                'aria-label': 'Date range input',
                'aria-invalid': error,
                'aria-describedby': error ? 'date-range-error' : undefined,
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
            initialDateRange={
              Array.isArray(value) && value[0]
                ? {
                  startDate: new Date(value[0] + 'T08:00:00.000Z'),
                  endDate: new Date(value[1] + 'T08:00:00.000Z'),
                }
                : {
                  startDate: minDate,
                  endDate: maxDate,
                }
            }
            minDate={minDate}
            maxDate={maxDate}
            hideDefaultRanges={true}
            customProps={{
              onSubmit: (range) => handleSetDateRangeOnSubmit(range),
              onCloseCallback: handleClose,
              RangeSeparatorIcons: {
                xs: ArrowCircleDownIcon,
                md: ArrowCircleRightIcon,
              },
            }}
            modalProps={{
              open,
              anchorEl,
              onClose: handleClose,
              disablePortal: true,
              slotProps: {
                paper: {
                  sx: {
                    borderRadius: '16px',
                    boxShadow: 'rgba(0, 0, 0, 0.21) 0px 0px 4px',
                    '.MuiButton-containedPrimary': {
                      backgroundColor: 'primary.main',
                      color: '#fff',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                    },
                  },
                },
              },
              anchorOrigin: {
                vertical: 'bottom',
                horizontal: 'left',
              },
            }}
          />
        </ThemeProvider>
      </div>
    )
  }
)

DateRangeCellEditor.displayName = 'DateRangeCellEditor'
