import { useEffect, useState } from 'react'
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel
} from '@mui/material'
import { Controller } from 'react-hook-form'
import PropTypes from 'prop-types'

export const BCFormCheckbox = ({ name, control, setValue, label, options }) => {
  const [selectedItems, setSelectedItems] = useState([])
  // we are handling the selection manually here
  const handleSelect = (value) => {
    const isPresent = selectedItems.indexOf(value)
    if (isPresent !== -1) {
      const remaining = selectedItems.filter((item) => item !== value)
      setSelectedItems(remaining)
    } else {
      setSelectedItems((prevItems) => [...prevItems, value])
    }
  }

  // we are setting form value manually here
  useEffect(() => {
    setValue(name, selectedItems)
  }, [name, selectedItems, setValue])

  return (
    <FormControl size={'small'} variant={'outlined'}>
      <FormLabel component="legend">{label}</FormLabel>

      <div>
        {options.map((option) => {
          return (
            <FormControlLabel
              control={
                <Controller
                  name={name}
                  render={({ field }) => {
                    return (
                      <Checkbox
                        checked={selectedItems.includes(option.value)}
                        onChange={() => handleSelect(option.value)}
                      />
                    )
                  }}
                  control={control}
                />
              }
              label={option.label}
              key={option.value}
            />
          )
        })}
      </div>
    </FormControl>
  )
}

BCFormCheckbox.propTypes = {
  name: PropTypes.string.isRequired,
  control: PropTypes.any.isRequired,
  label: PropTypes.string,
  setValue: PropTypes.any,
  options: PropTypes.array.isRequired,
}
