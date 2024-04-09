import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  Typography
} from '@mui/material'
import { Controller } from 'react-hook-form'
import { CustomLabel } from './CustomLabel'
import PropTypes from 'prop-types'

export const BCFormCheckbox = ({ name, form, label, options, disabled }) => {
  const { control } = form
  const handleSelect = (selectedValue) => (currentValues) => {
    if (currentValues.includes(selectedValue)) {
      return currentValues.filter((value) => value !== selectedValue)
    } else {
      return [...currentValues, selectedValue]
    }
  }

  return (
    <FormControl size={'small'} variant={'outlined'}>
      <FormLabel component="legend">
        <Typography variant="label" component="span">
          {label}
        </Typography>
      </FormLabel>

      <div>
        {options.map((option) => {
          return (
            <FormControlLabel
              sx={{ marginY: 2 }}
              control={
                <Controller
                  name={name}
                  render={({ field: { onChange, value } }) => {
                    return (
                      <Checkbox
                        id={option.value.toLowerCase().replace(/\s/g, "-")}
                        sx={{ marginTop: 0.5 }}
                        checked={value.includes(option.value)}
                        onChange={() =>
                          onChange(handleSelect(option.value)(value))
                        }
                        disabled={disabled}
                      />
                    )
                  }}
                  control={control}
                />
              }
              label={
                option.header ? (
                  <CustomLabel header={option.header} text={option.text} />
                ) : (
                  option.label
                )
              }
              key={option.value}
            />
          )
        })}
      </div>
    </FormControl>
  )
}

BCFormCheckbox.defaultProps = {
  initialItems: []
}
BCFormCheckbox.displayName = 'BCFormCheckbox'
BCFormCheckbox.propTypes = {
  name: PropTypes.string.isRequired,
  form: PropTypes.any.isRequired,
  label: PropTypes.string,
  options: PropTypes.array.isRequired,
  disabled: PropTypes.bool,
  initialItems: PropTypes.array
}
