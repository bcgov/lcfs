import React, { useState, useEffect, forwardRef } from 'react'
import { TextField, Autocomplete, Box, Grid } from '@mui/material'
import { LocationOn as LocationOnIcon } from '@mui/icons-material'
import parse from 'autosuggest-highlight/parse'
import match from 'autosuggest-highlight/match'
import BCTypography from '../BCTypography'
import { ADDRESS_SEARCH_URL } from '@/constants/common'

export const AddressAutocomplete = forwardRef(
  ({ className, value, onChange, onSelectAddress, disabled }, ref) => {
    const [inputValue, setInputValue] = useState(value || '')
    const [options, setOptions] = useState([])
    const [loading, setLoading] = useState(false)
    const [isAddressSelected, setIsAddressSelected] = useState(false)

    useEffect(() => {
      if (!inputValue || inputValue.length < 1) {
        setOptions([])
        return
      }

      // Don't fetch if user is just adding postal code to selected address
      if (
        isAddressSelected &&
        inputValue.includes(',') &&
        (inputValue.endsWith(' ') ||
          /[A-Za-z][0-9][A-Za-z]/.test(inputValue.slice(-3)))
      ) {
        return
      }

      const controller = new AbortController()
      const signal = controller.signal

      const fetchAddresses = async () => {
        setLoading(true)
        try {
          const response = await fetch(
            ADDRESS_SEARCH_URL + encodeURIComponent(inputValue),
            {
              signal
            }
          )

          if (!response.ok) throw new Error('Network response was not ok')
          const data = await response.json()
          const addresses = data.features.map((feature) => ({
            fullAddress: feature.properties.fullAddress || '',
            streetAddress: feature.properties.streetAddress || '',
            localityName: feature.properties.localityName || ''
          }))
          setOptions(addresses.filter((addr) => addr.fullAddress))
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.error('Error fetching addresses:', error)
          }
        }
        setLoading(false)
      }

      const delayDebounceFn = setTimeout(() => {
        fetchAddresses()
      }, 500)

      return () => {
        clearTimeout(delayDebounceFn)
        controller.abort()
      }
    }, [inputValue, isAddressSelected])

    return (
      <Autocomplete
        className={className}
        sx={{
          '& .MuiOutlinedInput-root': {
            padding: '7.5px 4px 7.5px 5px',
            background: 'white'
          },
          '& .MuiInputBase-root': {
            lineHeight: '1.4375em',
            height: '47px'
          }
        }}
        freeSolo
        options={options}
        loading={loading}
        filterOptions={(x) => x}
        value={value || inputValue}
        disabled={disabled}
        getOptionLabel={(option) => {
          return typeof option === 'string' ? option : option.fullAddress
        }}
        onInputChange={(event, newInputValue) => {
          if (onChange) {
            onChange(newInputValue)
          }
          setInputValue(newInputValue)

          // If user is typing after selecting an address, we'll assume they're
          // modifying it (likely adding postal code), so don't trigger a new search
          if (isAddressSelected && event && event.type === 'change') {
            // Keep isAddressSelected true as they're just modifying it
          } else if (
            event &&
            (event.type === 'click' || event.type === 'change')
          ) {
            // Reset when user clears the field or starts fresh typing
            setIsAddressSelected(false)
          }
        }}
        onChange={(event, newValue) => {
          if (newValue) {
            // Mark that an address has been selected
            setIsAddressSelected(true)

            if (onSelectAddress) {
              if (typeof newValue === 'string') {
                onSelectAddress(newValue)
              } else {
                const [streetAddress, city] = newValue.fullAddress.split(', ')
                onSelectAddress({
                  fullAddress: newValue.fullAddress,
                  inputValue,
                  streetAddress,
                  city
                })
              }
            } else if (onChange) {
              // Default behavior: just set the field value
              onChange(
                typeof newValue === 'string' ? newValue : newValue?.fullAddress
              )
            }
          }
        }}
        renderInput={(params) => (
          <Box mb={2}>
            <TextField
              {...params}
              variant="outlined"
              fullWidth
              placeholder={
                isAddressSelected
                  ? 'Add postal code...'
                  : 'Start typing address...'
              }
            />
          </Box>
        )}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props
          const matches = match(option.fullAddress, inputValue, {
            insideWords: true
          })

          const parts = parse(option.fullAddress, matches)
          return (
            <li key={key} {...optionProps}>
              <Grid container sx={{ alignItems: 'center' }}>
                <Grid sx={{ display: 'flex', width: 44 }}>
                  <LocationOnIcon sx={{ color: 'text' }} />
                </Grid>
                <Grid
                  sx={{ width: 'calc(100% - 44px)', wordWrap: 'break-word' }}
                >
                  {parts.map((part, index) => (
                    <Box
                      key={index}
                      component="span"
                      sx={{
                        fontWeight: part.highlight
                          ? 'fontWeightBold'
                          : 'fontWeightRegular'
                      }}
                    >
                      {part.text}
                    </Box>
                  ))}
                  <BCTypography variant="body2" color="text" fontSize="0.75rem">
                    Select and add postal code
                  </BCTypography>
                </Grid>
              </Grid>
            </li>
          )
        }}
      />
    )
  }
)

AddressAutocomplete.displayName = 'AddressAutocomplete'
