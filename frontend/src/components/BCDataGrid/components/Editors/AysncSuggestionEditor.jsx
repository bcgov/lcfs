import { forwardRef, useState, useMemo } from 'react'
import { Box, TextField, Autocomplete, Grid } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { debounce } from 'lodash'
import parse from 'autosuggest-highlight/parse'
import match from 'autosuggest-highlight/match'

export const AysncSuggestionEditor = forwardRef(
  ({ value, onValueChange, eventKey, rowIndex, column, ...props }, ref) => {
    const [inputValue, setInputValue] = useState('')
    const { data: options, isLoading } = useQuery({
      queryKey: ['async search', inputValue],
      queryFn: async () => {
        const response = await fetch(
          `http://localhost:4000/top100Films?title_like=${encodeURIComponent(
            inputValue
          )}`
        )
        if (!response.ok) {
          throw new Error('Network response was not ok')
        }
        return response.json()
      },
      enabled: inputValue !== '', // Fetch only when inputValue is not empty
      retry: false,
      refetchOnWindowFocus: false // Prevent refetching on window focus
    })

    const debouncedSetInputValue = useMemo(
      (newInputValue) =>
        debounce((newInputValue) => {
          setInputValue(newInputValue)
        }, 500),
      [inputValue]
    )

    const handleInputChange = (event, newInputValue) => {
      debouncedSetInputValue(newInputValue)
      // Update the value based on the input
      onValueChange(newInputValue)
    }

    return (
      <Autocomplete
        freeSolo
        id="async-search-editor"
        sx={{ width: 300 }}
        getOptionLabel={(option) =>
          typeof option === 'string' ? option : option.title
        }
        options={options || []}
        includeInputInList
        value={value}
        onInputChange={handleInputChange}
        loading={isLoading}
        noOptionsText="No suggestions..."
        renderInput={(params) => (
          <TextField {...params} label="Add a movie" fullWidth />
        )}
        renderOption={(props, option, { inputValue }) => {
          const matches = match(option.title, inputValue, { insideWords: true })
          const parts = parse(option.title, matches)

          return (
            <li {...props}>
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
    )
  }
)

AysncSuggestionEditor.displayName = 'AysncSuggestionEditor'
