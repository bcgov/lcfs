import { useState, forwardRef } from 'react'
import { InputAdornment, TextField, IconButton } from '@mui/material'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { PickerModal } from 'mui-daterange-picker-plus'
import { format } from 'date-fns'
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight'
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown'
import InputMask from 'react-input-mask'

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

    const handleSetDateRangeOnSubmit = (dateRange) => {
      handleClose() // close the modal
      const formattedRange = [
        format(new Date(dateRange.startDate.toUTCString()), 'yyyy-MM-dd'),
        format(new Date(dateRange.endDate.toUTCString()), 'yyyy-MM-dd')
      ]
      onValueChange(formattedRange)
    }

    const handleTextFieldChange = (event) => {
      onValueChange(event.target.value)
    }
    return (
      <>
        <InputMask
          mask="9999-99-99 to 9999-99-99"
          value={value}
          disabled={false}
          onChange={handleTextFieldChange}
        >
          {() => (
            <TextField
              ref={ref}
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
          )}
        </InputMask>
        <PickerModal
          initialDateRange={
            Array.isArray(value) && value[0]
              ? {
                  startDate: new Date(value[0] + 'T08:00:00.000Z'),
                  endDate: new Date(value[1] + 'T08:00:00.000Z')
                }
              : {
                  startDate: new Date(props.minDate + 'T08:00:00.000Z'),
                  endDate: new Date(props.maxDate + 'T08:00:00.000Z')
                }
          }
          minDate={new Date(props.minDate + 'T08:00:00.000Z')}
          maxDate={new Date(props.maxDate + 'T08:00:00.000Z')}
          hideDefaultRanges={true}
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
