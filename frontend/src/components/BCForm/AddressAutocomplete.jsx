import React, { useState, useEffect, forwardRef, useRef } from 'react'
import { TextField, Autocomplete, Box, Grid, CircularProgress } from '@mui/material'
import { LocationOn as LocationOnIcon } from '@mui/icons-material'
import parse from 'autosuggest-highlight/parse'
import match from 'autosuggest-highlight/match'
import BCTypography from '../BCTypography'
import useGeocoder from '@/hooks/useGeocoder'

/**
 * Enhanced AddressAutocomplete component using the consolidated geocoder service.
 * Provides better caching, error handling, and consistency across the application.
 */
export const AddressAutocomplete = forwardRef(
  ({ className, value, onChange, onSelectAddress, disabled, minScore = 50, maxResults = 5, id }, ref) => {
    const [inputValue, setInputValue] = useState(value || '')
    const [options, setOptions] = useState([])
    const [isAddressSelected, setIsAddressSelected] = useState(false)
    
    const { autocompleteAddress, validateAddress } = useGeocoder()
    const timeoutRef = useRef()

    const fetchAddresses = async (searchValue) => {
      if (!searchValue || searchValue.length < 3) {
        setOptions([])
        return
      }

      // Don't fetch if user is just adding postal code to selected address
      if (
        isAddressSelected &&
        searchValue.includes(',') &&
        (searchValue.endsWith(' ') ||
          /[A-Za-z][0-9][A-Za-z]/.test(searchValue.slice(-3)))
      ) {
        return
      }

      try {
        // Use the new autocomplete endpoint
        const result = await autocompleteAddress.mutateAsync({
          partialAddress: searchValue,
          maxResults
        })

        if (result.suggestions) {
          // Suggestions now come as complete AddressSchema objects
          const addresses = result.suggestions.map((addr) => ({
            fullAddress: addr.full_address,
            streetAddress: addr.street_address || '',
            city: addr.city || '',
            localityName: addr.city || '',
            province: addr.province || '',
            postalCode: addr.postal_code || '',
            postal_code: addr.postal_code || '',
            latitude: addr.latitude,
            longitude: addr.longitude,
            score: addr.score
          }))
          
          setOptions(addresses)
        }
      } catch (error) {
        console.error('Error fetching addresses:', error)
        setOptions([])
      }
    }

    useEffect(() => {
      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Clear options immediately if input is too short
      if (!inputValue || inputValue.length < 3) {
        setOptions([])
        return
      }

      // Set new timeout for API call
      timeoutRef.current = setTimeout(() => {
        fetchAddresses(inputValue)
      }, 500)

      // Cleanup
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    }, [inputValue]) // Only depend on inputValue

    const isLoading = autocompleteAddress.isPending || validateAddress.isPending

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
        loading={isLoading}
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
        onChange={async (event, newValue) => {
          if (newValue) {
            // Mark that an address has been selected
            setIsAddressSelected(true)

            if (onSelectAddress) {
              if (typeof newValue === 'string') {
                // For string selections, still validate to get detailed info
                try {
                  const validationResult = await validateAddress.mutateAsync({
                    addressString: newValue,
                    minScore: 50,
                    maxResults: 1
                  })
                  
                  if (validationResult.addresses && validationResult.addresses.length > 0) {
                    const addr = validationResult.addresses[0]
                    const addressData = {
                      fullAddress: addr.full_address || newValue,
                      streetAddress: addr.street_address || '',
                      city: addr.city || '',
                      province: addr.province || '',
                      postalCode: addr.postal_code || '',
                      latitude: addr.latitude,
                      longitude: addr.longitude,
                      score: addr.score
                    }
                    
                    // Auto-populate postal code in the input field
                    const fullAddressWithPostal = addr.postal_code 
                      ? `${addr.full_address}, ${addr.postal_code}`
                      : addr.full_address
                    setInputValue(fullAddressWithPostal)
                    if (onChange) onChange(fullAddressWithPostal)
                    
                    onSelectAddress(addressData)
                  } else {
                    onSelectAddress(newValue)
                  }
                } catch (error) {
                  console.error('Error validating selected address:', error)
                  onSelectAddress(newValue)
                }
              } else {
                // For object selections, use the data directly from autocomplete
                // Since autocomplete now returns complete AddressSchema objects
                const addressData = {
                  fullAddress: newValue.fullAddress,
                  streetAddress: newValue.streetAddress || '',
                  city: newValue.localityName || newValue.city || '',
                  province: newValue.province || '',
                  postalCode: newValue.postalCode || newValue.postal_code || '',
                  latitude: newValue.latitude,
                  longitude: newValue.longitude,
                  score: newValue.score
                }
                
                // Auto-populate postal code in the input field
                const postalCode = newValue.postalCode || newValue.postal_code
                const fullAddressWithPostal = postalCode 
                  ? `${newValue.fullAddress}, ${postalCode}`
                  : newValue.fullAddress
                setInputValue(fullAddressWithPostal)
                if (onChange) onChange(fullAddressWithPostal)
                
                onSelectAddress(addressData)
              }
            } else if (onChange) {
              // Default behavior: just set the field value with postal code if available
              if (typeof newValue === 'string') {
                onChange(newValue)
              } else {
                const postalCode = newValue.postalCode || newValue.postal_code
                const fullAddressWithPostal = postalCode 
                  ? `${newValue.fullAddress}, ${postalCode}`
                  : newValue.fullAddress
                setInputValue(fullAddressWithPostal)
                onChange(fullAddressWithPostal)
              }
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
                  ? 'Postal code included'
                  : 'Start typing address...'
              }
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
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
                    {option.score ? `Confidence: ${option.score}% • ` : ''}
                    {option.postalCode || option.postal_code ? 'Address with postal code' : 'Select to add postal code'}
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
