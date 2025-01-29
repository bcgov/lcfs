import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { TextField } from '@mui/material'
import { styled } from '@mui/material/styles'

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-input': {
    padding: theme.spacing(1.2),
    fontSize: theme.typography.body2.fontSize
  },
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: theme.palette.divider
    },
    '&:hover fieldset': {
      borderColor: theme.palette.primary.main
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main
    }
  }
}))

export const NumberEditor = forwardRef(
  ({ value, onValueChange, eventKey, rowIndex, column, ...props }, ref) => {
    const inputRef = useRef(null)

    useEffect(() => {
      if (inputRef) {
        inputRef.current.focus()
      }
    }, [])

    useImperativeHandle(ref, () => {
      return {
        getValue() {
          return value.replace(/,/g, '') // Remove commas when returning the value
        },
        isCancelBeforeStart() {
          return false
        },
        isCancelAfterEnd() {
          return false
        }
      }
    })

    const formatNumber = (num) => {
      if (isNaN(num) || num === undefined || num === null) return 0
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }

    const onInputChange = (event) => {
      const newValue = event.target.value.replace(/,/g, '')
      if (
        newValue === '' ||
        (isFinite(newValue) && !isNaN(parseFloat(newValue)))
      ) {
        let numValue = parseFloat(newValue)
        if (numValue < props.min) numValue = props.min
        if (numValue > props.max) numValue = props.max
        onValueChange(parseInt(numValue) || 0)
      }
    }

    return (
      <StyledTextField
        inputRef={inputRef}
        value={formatNumber(value)}
        onChange={onInputChange}
        variant="outlined"
        margin="none"
        fullWidth
        size="small"
        inputProps={{
          inputMode: 'numeric',
          min: props.min,
          max: props.max
        }}
      />
    )
  }
)

NumberEditor.displayName = 'NumberEditor'
