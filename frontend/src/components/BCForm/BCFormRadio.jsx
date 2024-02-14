import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup
} from '@mui/material'
import { Controller } from 'react-hook-form'
import PropTypes from 'prop-types'

const options = [
  {
    label: 'Radio Option 1',
    value: '1'
  },
  {
    label: 'Radio Option 2',
    value: '2'
  }
]

export const BCFormRadio = ({ name, control, label }) => {
  const generateRadioOptions = () => {
    return options.map((singleOption, idx) => (
      <FormControlLabel
        key={idx}
        value={singleOption.value}
        label={singleOption.label}
        control={<Radio />}
      />
    ))
  }

  return (
    <FormControl component="fieldset">
      <FormLabel component="legend">{label}</FormLabel>
      <Controller
        name={name}
        control={control}
        render={({
          field: { onChange, value },
          fieldState: { error },
          formState
        }) => (
          <RadioGroup value={value} onChange={onChange}>
            {generateRadioOptions()}
          </RadioGroup>
        )}
      />
    </FormControl>
  )
}

BCFormRadio.propTypes = {
  name: PropTypes.string.isRequired,
  control: PropTypes.any.isRequired,
  label: PropTypes.string,
  setValue: PropTypes.any
}