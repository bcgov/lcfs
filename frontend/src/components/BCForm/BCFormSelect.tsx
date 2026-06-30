import PropTypes from 'prop-types'
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import { Controller } from 'react-hook-form'
import type { ReactNode } from 'react'

export interface BCFormSelectOption {
  label: ReactNode
  value: string | number
}

export interface BCFormSelectProps {
  name: string
  control: any
  label?: ReactNode
  options: BCFormSelectOption[]
}

export const BCFormSelect = ({
  name,
  control,
  label,
  options = []
}: BCFormSelectProps) => {
  const generateSingleOptions = () => {
    return options.map((option, index) => (
      <MenuItem
        key={option.value || String(option.label) || `select-option-${index}`}
        value={option.value}
      >
        {option.label}
      </MenuItem>
    ))
  }

  return (
    <FormControl size={'small'}>
      <InputLabel>{label}</InputLabel>
      <Controller
        render={({ field: { onChange, value } }) => (
          <Select onChange={onChange} value={value}>
            {generateSingleOptions()}
          </Select>
        )}
        control={control}
        name={name}
      />
    </FormControl>
  )
}

BCFormSelect.propTypes = {
  name: PropTypes.string.isRequired,
  control: PropTypes.any.isRequired,
  label: PropTypes.string,
  setValue: PropTypes.any,
  options: PropTypes.array.isRequired
}
