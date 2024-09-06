import BCBox from '@/components/BCBox'
import { useApiService } from '@/services/useApiService'
import { Autocomplete, Box, Grid, TextField } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import match from 'autosuggest-highlight/match'
import parse from 'autosuggest-highlight/parse'
import { debounce } from 'lodash'
import { useMemo, useState } from 'react'

export const AsyncSuggestionEditor = ({
  value = '',
  onValueChange,
  enabled = true,
  queryKey,
  queryFn,
  debounceValue,
  onKeyDownCapture,
  api,
  optionLabel
}) => {
  const [inputValue, setInputValue] = useState('')
  const apiService = useApiService()
  const { data: options } = useQuery({
    queryKey: [queryKey || 'async-suggestion', inputValue],
    queryFn: async ({ queryKey }) => queryFn({ client: apiService, queryKey }),
    enabled: inputValue !== '' && enabled,
    retry: false,
    refetchOnWindowFocus: false
  })

  const debouncedSetInputValue = useMemo(
    () =>
      debounce((newInputValue) => {
        setInputValue(newInputValue)
      }, debounceValue || 500), // by default 1/2 second delay between calls
    [debounceValue]
  )

  const handleInputChange = (_, newInputValue) => {
    debouncedSetInputValue(newInputValue)
    // Update the value based on the input
    onValueChange(newInputValue)
  }

  const handleKeyDown = (event) => {
    if (onKeyDownCapture) {
      onKeyDownCapture(event)
    } else if (event.key === 'Tab') {
      event.preventDefault()
      api.tabToNextCell()
    }
  }

  return (
    <BCBox
      component="div"
      aria-label="Select options from the drop down"
      data-testid="ag-grid-editor-select-options"
      sx={{
        '& .MuiAutocomplete-inputRoot': {
          paddingBottom: '4px',
          backgroundColor: '#fff'
        }
      }}
    >
      <Autocomplete
        sx={{
          '.MuiOutlinedInput-root': {
            padding: '2px 0px 2px 0px'
          }
        }}
        freeSolo
        id="async-search-editor"
        getOptionLabel={(option) =>
          typeof option === 'string' ? option : option.title
        }
        options={
          options
            ? Array.isArray(options)
              ? options.map((item) => ({ title: item }))
              : options[optionLabel].map((item) => ({ title: item }))
            : []
        }
        includeInputInList
        value={value}
        onInputChange={handleInputChange}
        onKeyDownCapture={handleKeyDown}
        // loading={isLoading}
        noOptionsText="No suggestions..."
        renderInput={(params) => <TextField {...params} fullWidth autoFocus />}
        renderOption={({ key, ...props }, option, { inputValue }) => {
          const matches = match(option.title, inputValue, {
            insideWords: true
          })
          const parts = parse(option.title, matches)

          return (
            <li key={key} {...props}>
              <Grid container alignItems="center">
                <Grid
                  item
                  sx={{ width: 'calc(100% - 44px)', wordWrap: 'break-word' }}
                >
                  {parts.map((part, index) => (
                    <Box
                      key={index}
                      component="span"
                      sx={{ fontWeight: part.highlight ? 'bold' : 'regular' }}
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
    </BCBox>
  )
}
