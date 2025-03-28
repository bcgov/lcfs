import React, { useState } from 'react'
import { Controller } from 'react-hook-form'
import { Box, InputLabel } from '@mui/material'
import { Info } from '@mui/icons-material'
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
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
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
          <Box position="relative">
            <AddressAutocomplete
              value={value}
              onChange={(newValue) => {
                onChange(newValue)
                // Show tooltip when address is selected or changed
                if (newValue && newValue.length > 0) {
                  setShowTooltip(true)
                  // Hide tooltip after 5 seconds
                  setTimeout(() => setShowTooltip(false), 5000)
                }
              }}
              onSelectAddress={(addressData) => {
                if (onSelectAddress) {
                  onSelectAddress(addressData)
                }
                // Show tooltip when an address is selected from dropdown
                setShowTooltip(true)
                // Hide tooltip after 5 seconds
                setTimeout(() => setShowTooltip(false), 5000)
              }}
              disabled={disabled}
            />
            {showTooltip && (
              <Box
                position="absolute"
                right="10px"
                top="-35px"
                display="flex"
                alignItems="center"
                bgcolor="rgba(255, 255, 255, 0.95)"
                p={1}
                borderRadius="4px"
                boxShadow="0 2px 5px rgba(0,0,0,0.2)"
                zIndex={10}
              >
                <Info color="primary" sx={{ mr: 1 }} fontSize="small" />
                <BCTypography variant="body4" component="span">
                  Please add postal code to the address
                </BCTypography>
              </Box>
            )}
          </Box>
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
