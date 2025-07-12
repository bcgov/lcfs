import { useState, useEffect, useCallback } from 'react'
import { FormControl, IconButton, InputAdornment } from '@mui/material'
import {
  Clear as ClearIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers'
import { format, isValid } from 'date-fns'

export const BCDateFloatingFilter = ({
  model,
  onModelChange,
  disabled = false,
  minDate = '2013-01-01',
  maxDate = '2040-01-01',
  initialFilterType = 'any',
  label = 'Select Date'
}) => {
  const [selectedDate, setSelectedDate] = useState(null)
  const [open, setOpen] = useState(false)

  const handleChange = useCallback(
    (newDate) => {
      setSelectedDate(newDate)

      if (newDate && isValid(newDate)) {
        const filterModel = {
          filterType: 'date',
          type: initialFilterType,
          dateFrom: format(newDate, 'yyyy-MM-dd'),
          dateTo:
            initialFilterType === 'inRange'
              ? format(newDate, 'yyyy-MM-dd')
              : undefined
        }
        onModelChange(filterModel)
      } else {
        onModelChange(undefined)
      }
    },
    [onModelChange, initialFilterType]
  )

  const handleClear = (event) => {
    event.stopPropagation()
    setSelectedDate(null)
    onModelChange(undefined)
  }

  const handleOpen = () => {
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
  }

  useEffect(() => {
    if (!model) {
      setSelectedDate(null)
      return
    }

    if (model?.dateFrom) {
      const date = new Date(model.dateFrom)
      setSelectedDate(isValid(date) ? date : null)
    }
  }, [model])

  return (
    <FormControl
      className="bc-column-date-filter"
      fullWidth
      size="small"
      role="group"
      aria-labelledby="date-picker-label"
      sx={{
        border: 'none',
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
        '& .Mui-focused': {
          border: '1px solid #495057',
          boxShadow: '0 0 0 1px #495057'
        }
      }}
    >
      <DatePicker
        id="date-picker"
        aria-label="Date Picker"
        aria-describedby="date-picker-description"
        sx={{
          border: 'none',
          borderBottom: '4px solid #495057'
        }}
        value={selectedDate}
        minDate={new Date(minDate)}
        maxDate={new Date(maxDate)}
        onChange={handleChange}
        open={open}
        onOpen={handleOpen}
        onClose={handleClose}
        disabled={disabled}
        format="yyyy-MM-dd"
        slotProps={{
          textField: {
            size: 'small',
            label,
            InputProps: {
              startAdornment: (
                <InputAdornment position="start">
                  <IconButton
                    sx={{ marginLeft: 0, paddingLeft: '6px' }}
                    size="small"
                    edge="start"
                    onClick={() => setOpen(true)}
                    aria-label="Open calendar"
                  >
                    <CalendarIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
              endAdornment: selectedDate && (
                <InputAdornment position="end">
                  <IconButton
                    sx={{ marginRight: 0, paddingRight: '6px' }}
                    size="small"
                    onClick={handleClear}
                    onMouseDown={(event) => event.stopPropagation()}
                    edge="end"
                    aria-label="Clear date"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }
          }
        }}
      />
    </FormControl>
  )
}

BCDateFloatingFilter.displayName = 'BCDateFloatingFilter'
