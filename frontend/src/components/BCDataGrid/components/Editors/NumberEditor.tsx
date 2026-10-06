import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import TextField from '@mui/material/TextField'
import { styled } from '@mui/material/styles'
import type { ChangeEvent } from 'react'

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

export interface NumberEditorProps {
  value?: string | number
  onValueChange: (value: number) => void
  eventKey?: string
  rowIndex?: number
  column?: any
  min?: number
  max?: number
}

export const NumberEditor = forwardRef<unknown, NumberEditorProps>(
  (
    {
      value,
      onValueChange,
      eventKey,
      rowIndex,
      column,
      ...props
    }: Omit<NumberEditorProps, 'ref'>,
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
      inputRef.current?.focus()
    }, [])

    useImperativeHandle(ref, () => {
      return {
        getValue() {
          return String(value).replace(/,/g, '') // Remove commas when returning the value
        },
        isCancelBeforeStart() {
          return false
        },
        isCancelAfterEnd() {
          return false
        }
      }
    })

    const formatNumber = (num: string | number | undefined) => {
      if (num === undefined || num === null || Number.isNaN(Number(num)))
        return 0
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }

    const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value.replace(/,/g, '')
      if (
        newValue === '' ||
        (Number.isFinite(Number(newValue)) &&
          !Number.isNaN(parseFloat(newValue)))
      ) {
        let numValue = parseFloat(newValue)
        if (props.min != null && numValue < props.min) numValue = props.min
        if (props.max != null && numValue > props.max) numValue = props.max
        onValueChange(Number.isNaN(numValue) ? 0 : Math.trunc(numValue))
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
