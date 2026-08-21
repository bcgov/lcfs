// @ts-nocheck
import { useState, useEffect, useCallback } from 'react'
import { FormControl, IconButton, InputAdornment } from '@mui/material'
import {
  Clear as ClearIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers'
import { format, isValid } from 'date-fns'

export interface BCDateFloatingFilterProps {
  model?: any
  onModelChange: (model: any) => void
  disabled?: boolean
  minDate?: string
  maxDate?: string
  initialFilterType?: string
  label?: string
}

const parseDateOnly = (value) => {
  if (value instanceof Date) return value
  if (typeof value !== 'string') return null

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const parsed = new Date(value)
  return isValid(parsed) ? parsed : null
}

export const BCDateFloatingFilter = ({
  model,
  onModelChange,
  disabled = false,
  minDate = '2013-01-01',
  maxDate = '2040-01-01',
  initialFilterType = 'equals',
  label = 'Select date'
}: BCDateFloatingFilterProps) => {
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
      const date = parseDateOnly(model.dateFrom)
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
        aria-label="Date picker"
        aria-describedby="date-picker-description"
        sx={{
          border: 'none',
          borderBottom: '4px solid #495057'
        }}
        value={selectedDate}
        minDate={parseDateOnly(minDate)}
        maxDate={parseDateOnly(maxDate)}
        onChange={handleChange}
        open={open}
        onOpen={handleOpen}
        onClose={handleClose}
        disabled={disabled}
        format="yyyy-MM-dd"
        openTo="day"
        views={['year', 'month', 'day']}
        slotProps={{
          textField: {
            size: 'small',
            label,
            onKeyDown: (event) => event.stopPropagation(),
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
