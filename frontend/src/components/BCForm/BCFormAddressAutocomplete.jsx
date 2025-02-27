import React from 'react'
import { Controller } from 'react-hook-form'
import { InputLabel, Box } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import PropTypes from 'prop-types'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import { AddressAutocomplete } from './AddressAutocomplete'

export const BCFormAddressAutocomplete = ({
  name,
  control,
  label,
  optional,
  checkbox,
  checkboxLabel,
  onCheckboxChange,
  isChecked,
  disabled,
  onSelectAddress
}) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({
        field: { onChange, value },
        fieldState: { error },
        formState
      }) => (
        <>
          <InputLabel htmlFor={name} component="label" className="form-label">
            <Box display="flex" gap={2} flexWrap="wrap">
              <BCTypography variant="label" component="span">
                {label}:&nbsp;
                {optional && (
                  <span className="optional" style={{ fontWeight: 'normal' }}>
                    (optional)
                  </span>
                )}
              </BCTypography>
              {checkbox && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isChecked}
                      onChange={onCheckboxChange}
                      size="small"
                      sx={{
                        marginTop: 0.5,
                        '& .MuiSvgIcon-root': {
                          border: '0.0625rem solid rgb(63, 65, 68)'
                        }
                      }}
                    />
                  }
                  label={
                    <BCTypography variant="body4" component="span" color="text">
                      {checkboxLabel}
                    </BCTypography>
                  }
                  sx={{ ml: 2 }}
                />
              )}
            </Box>
          </InputLabel>
          <AddressAutocomplete
            value={value}
            onChange={onChange}
            onSelectAddress={onSelectAddress}
            disabled={disabled}
          />
          {error && (
            <BCTypography variant="body4" color="error" mt={0.5} ml={1.5}>
              {error.message}
            </BCTypography>
          )}
        </>
      )}
    />
  )
}

BCFormAddressAutocomplete.propTypes = {
  name: PropTypes.string.isRequired,
  control: PropTypes.any.isRequired,
  label: PropTypes.string,
  optional: PropTypes.bool,
  checkbox: PropTypes.bool,
  checkboxLabel: PropTypes.string,
  onCheckboxChange: PropTypes.func,
  isChecked: PropTypes.bool,
  disabled: PropTypes.bool,
  onSelectAddress: PropTypes.func
}
