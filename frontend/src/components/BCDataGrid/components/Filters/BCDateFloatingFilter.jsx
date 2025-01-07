import { useState, useEffect, useCallback } from 'react'
import { FormControl, IconButton, InputAdornment } from '@mui/material'
import {
  Clear as ClearIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers'
import { format, isValid } from 'date-fns'
import dayjs from 'dayjs'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'

export const BCDateFloatingFilter = ({
  model,
  onModelChange,
  disabled = false,
  minDate = '2013-01-01',
  maxDate = '2040-01-01',
  initialFilterType = 'equals',
  label = 'Select Date'
}) => {
  const [selectedDate, setSelectedDate] = useState(null)
  const [open, setOpen] = useState(false)

  const handleChange = useCallback((newDate) => {
    setSelectedDate(newDate)

    if (newDate && newDate.isValid()) {
      // Validate with dayjs
      onModelChange({
        type: initialFilterType,
        dateFrom: newDate.format('YYYY-MM-DD'),
        dateTo: null,
        filterType: 'date'
      })
    } else {
      onModelChange(null)
    }
  }, [])

  const handleClear = (event) => {
    event.stopPropagation()
    setSelectedDate(null)
    onModelChange(null)
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
      const date = dayjs(model.dateFrom)
      setSelectedDate(date.isValid() ? date : null)
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
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DatePicker
          id="date-picker"
          aria-label="Date Picker"
          aria-describedby="date-picker-description"
          sx={{
            border: 'none',
            borderBottom: '4px solid #495057'
          }}
          value={selectedDate}
          minDate={dayjs(minDate)}
          maxDate={dayjs(maxDate)}
          onChange={handleChange}
          open={open}
          onOpen={handleOpen}
          onClose={handleClose}
          disabled={disabled}
          format="YYYY-MM-DD"
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
      </LocalizationProvider>
    </FormControl>
  )
}

BCDateFloatingFilter.displayName = 'BCDateFloatingFilter'
