import React, { useState, useEffect, forwardRef } from 'react'
import { TextField, Autocomplete, Box, Grid } from '@mui/material'
import { LocationOn as LocationOnIcon } from '@mui/icons-material'
import parse from 'autosuggest-highlight/parse'
import match from 'autosuggest-highlight/match'

export const AddressAutocomplete = forwardRef(
  ({ value, onChange, onSelectAddress }, ref) => {
    const [inputValue, setInputValue] = useState(value || '')
    const [options, setOptions] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
      if (!inputValue || inputValue.length < 3) {
        setOptions([])
        return
      }

      const controller = new AbortController()
      const signal = controller.signal

      const fetchAddresses = async () => {
        setLoading(true)
        try {
          const response = await fetch(
            `https://geocoder.api.gov.bc.ca/addresses.json?minScore=50&maxResults=5&echo=true&brief=true&autoComplete=true&exactSpelling=false&fuzzyMatch=false&matchPrecisionNot=&locationDescriptor=frontDoorPoint&addressString=${encodeURIComponent(
              inputValue
            )}`,
            { signal }
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
    }, [inputValue])

    return (
      <Autocomplete
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
        getOptionLabel={(option) => {
          return typeof option === 'string' ? option : option.fullAddress
        }}
        onInputChange={(event, newInputValue) => {
          if (onChange) {
            onChange(newInputValue)
          }
          setInputValue(newInputValue)
        }}
        onChange={(event, newValue) => {
          if (onSelectAddress && newValue) {
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
        }}
        renderInput={(params) => (
          <Box mb={2}>
            <TextField {...params} variant="outlined" fullWidth />
          </Box>
        )}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props
          const [street, city, province] = option.fullAddress.split(', ')
          const matches = match(option.fullAddress, inputValue, {
            insideWords: true
          })

          const parts = parse(option.fullAddress, matches)
          return (
            <li key={key} {...optionProps}>
              <Grid container sx={{ alignItems: 'center' }}>
                <Grid sx={{ display: 'flex', width: 44 }}>
                  <LocationOnIcon sx={{ color: 'text.secondary' }} />
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
