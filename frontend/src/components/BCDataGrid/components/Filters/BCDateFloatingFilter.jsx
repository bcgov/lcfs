import { useState, useEffect, useCallback } from 'react'
import { FormControl, IconButton, InputAdornment } from '@mui/material'
import {
  Clear as ClearIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers'
import { format, isValid } from 'date-fns'
import { getDateFromDateSections } from '@mui/x-date-pickers/internals/hooks/useField/useField.utils'

export const BCDateFloatingFilter = ({
  model,
  onModelChange,
  disabled = false,
  initialFilterType = 'equals',
  label = 'Select Date'
}) => {
  const [selectedDate, setSelectedDate] = useState(null)
  const [open, setOpen] = useState(false)

  const handleChange = useCallback((newDate) => {
    setSelectedDate(newDate)

    if (newDate && isValid(newDate)) {
      onModelChange({
        type: initialFilterType,
        dateFrom: format(newDate, 'yyyy-MM-dd'),
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

    if (model.filter) {
      const date = new Date(model.dateFrom)
      setSelectedDate(isValid(date) ? date : null)
    }
  }, [model])

  return (
    <FormControl
      className="bc-column-date-filter"
      fullWidth
      size="small"
      sx={{
        border: 'none',
        '& .MuiOutlinedInput-root': { p: 0 },
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
        '& .Mui-focused': {
          border: '1px solid #495057',
          boxShadow: '0 0 0 1px #495057'
        }
      }}
    >
      <DatePicker
        sx={{ border: 'none', borderBottom: '2px solid #495057' }}
        value={selectedDate}
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
                    size="small"
                    edge="start"
                    onClick={() => setOpen(true)}
                  >
                    <CalendarIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
              endAdornment: selectedDate && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleClear}
                    onMouseDown={(event) => event.stopPropagation()}
                    edge="end"
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
