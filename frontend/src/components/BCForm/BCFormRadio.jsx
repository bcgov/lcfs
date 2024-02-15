import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Typography
} from '@mui/material'
import { Controller } from 'react-hook-form'
import PropTypes from 'prop-types'
import { CustomLabel } from './CustomLabel'

export const BCFormRadio = ({ name, control, label, options, disabled }) => {
  const generateRadioOptions = () => {
    return options.map((singleOption, idx) => (
      <FormControlLabel
        key={singleOption.value}
        value={singleOption.value}
        label={
          singleOption.header ? (
            <CustomLabel
              header={singleOption.header}
              text={singleOption.text}
            />
          ) : (
            singleOption.label
          )
        }
        control={<Radio sx={{ marginTop: 0.5 }} disabled={disabled} />}
      />
    ))
  }

  return (
    <FormControl component="fieldset">
      <FormLabel component="legend" sx={{ marginBottom: 1 }}>
        <Typography variant="label" component="span">
          {label}
        </Typography>
      </FormLabel>
      <Controller
        name={name}
        control={control}
        render={({
          field: { onChange, value },
          fieldState: { error },
          formState
        }) => (
          <RadioGroup
            value={value}
            onChange={onChange}
            aria-labelledby={label}
            style={{
              gap: 8,
              marginTop: 8
            }}
          >
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
  setValue: PropTypes.any,
  options: PropTypes.array.isRequired
}
