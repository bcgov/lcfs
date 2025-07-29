import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel
} from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { Controller } from 'react-hook-form'
import { CustomLabel } from './CustomLabel'
import PropTypes from 'prop-types'

export const BCFormCheckbox = ({ name, form, label, options, disabled = false, initialItems = [] }) => {
  if (!form) {
    throw new Error('BCFormCheckbox requires a form prop')
  }
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
        <BCTypography variant="label" component="span">
          {label}
        </BCTypography>
      </FormLabel>

      <div>
        {options.map((option, index) => {
          return (
            <FormControlLabel
              sx={{ marginY: 2 }}
              control={
                <Controller
                  name={name}
                  render={({ field: { onChange, value } }) => {
                    return (
                      <Checkbox
                        id={option.value ? option.value.toLowerCase().replace(/\s/g, '-') : `checkbox-${option.label || 'unlabeled'}`}
                        sx={{ marginTop: 0.5 }}
                        checked={value && option.value ? value.includes(option.value) : false}
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
              key={option.value || option.label || `option-${index}`}
            />
          )
        })}
      </div>
    </FormControl>
  )
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
