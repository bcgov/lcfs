import { useState, forwardRef } from 'react'
import { InputAdornment, TextField, IconButton } from '@mui/material'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { PickerModal } from 'mui-daterange-picker-plus'
import { format } from 'date-fns'
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight'
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown'

export const DateRangeCellEditor = forwardRef(
  ({ value, onValueChange, eventKey, rowIndex, column, ...props }, ref) => {
    // State for the Modal
    const [anchorEl, setAnchorEl] = useState(null)

    const handleClick = (event) => {
      setAnchorEl(event.currentTarget)
    }

    const handleClose = () => {
      setAnchorEl(null)
    }

    const open = Boolean(anchorEl)

    // State for the DateRange Value
    const [dateRangeOnChange, setDateRangeOnChange] = useState({})
    const [dateRangeOnSubmit, setDateRangeOnSubmit] = useState({})

    const handleSetDateRangeOnChange = (dateRange) => {
      setDateRangeOnChange(dateRange)
    }

    const handleSetDateRangeOnSubmit = (dateRange) => {
      setDateRangeOnSubmit(dateRange)
      handleClose() // close the modal
      const formattedRange = [
        format(new Date(dateRange.startDate), 'yyyy-MM-dd'),
        format(new Date(dateRange.endDate), 'yyyy-MM-dd')
      ]
      onValueChange(formattedRange)
    }

    const handleTextFieldChange = (event) => {
      console.log(event.target.value)
      onValueChange(event.target.value)
    }
    return (
      <>
        <TextField
          ref={ref}
          value={value}
          onChange={handleTextFieldChange}
          fullWidth
          margin="0"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleClick}>
                  <CalendarTodayIcon />
                </IconButton>
              </InputAdornment>
            )
          }}
        />
        <PickerModal
          minDate={props.minDate}
          maxDate={props.maxDate}
          hideDefaultRanges={true}
          onChange={(range) => handleSetDateRangeOnChange(range)}
          customProps={{
            onSubmit: (range) => handleSetDateRangeOnSubmit(range),
            onCloseCallback: handleClose,
            RangeSeparatorIcons: {
              xs: ArrowCircleDownIcon,
              md: ArrowCircleRightIcon
            }
          }}
          modalProps={{
            open,
            anchorEl,
            onClose: handleClose,
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
            },
            anchorOrigin: {
              vertical: 'bottom',
              horizontal: 'left'
            }
          }}
        />
      </>
    )
  }
)

DateRangeCellEditor.displayName = 'DateRangeCellEditor'
