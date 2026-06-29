import {
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup
} from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { Controller } from 'react-hook-form'
import PropTypes from 'prop-types'
import { CustomLabel } from './CustomLabel'
import type { SxProps, Theme } from '@mui/material'
import type { ReactNode } from 'react'

export interface BCFormRadioOption {
  value: string | number
  label?: ReactNode
  header?: ReactNode
  text?: ReactNode
}

export interface BCFormRadioProps {
  name: string
  control: any
  label?: ReactNode
  options?: BCFormRadioOption[]
  disabled?: boolean
  orientation?: 'vertical' | 'horizontal'
  sx?: SxProps<Theme>
}

export const BCFormRadio = ({
  name,
  control,
  label,
  options = [],
  disabled,
  orientation = 'vertical',
  sx = {}
}: BCFormRadioProps) => {
  const generateRadioOptions = () => {
    return options.map((singleOption, index) => (
      <FormControlLabel
        key={
          singleOption.value ||
          String(singleOption.label) ||
          `radio-option-${index}`
        }
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
    <FormControl component="fieldset" sx={{ ...sx }}>
      <BCTypography variant="label" component="span">
        {label}
      </BCTypography>

      <Controller
        name={name}
        control={control}
        render={({ field: { onChange, value } }) => (
          <RadioGroup
            value={value}
            onChange={onChange}
            aria-labelledby={typeof label === 'string' ? label : undefined}
            row={orientation === 'horizontal'}
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
  options: PropTypes.array.isRequired,
  disabled: PropTypes.bool,
  orientation: PropTypes.oneOf(['vertical', 'horizontal'])
}
