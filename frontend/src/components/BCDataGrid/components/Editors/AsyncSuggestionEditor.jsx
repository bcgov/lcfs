import { forwardRef, useState, useMemo } from 'react'
import { Box, TextField, Autocomplete, Grid } from '@mui/material'
import BCBox from '@/components/BCBox'
import { debounce } from 'lodash'
import parse from 'autosuggest-highlight/parse'
import match from 'autosuggest-highlight/match'

export const AsyncSuggestionEditor = forwardRef(
  ({ value, onValueChange, eventKey, rowIndex, column, ...props }, ref) => {
    const [inputValue, setInputValue] = useState('')
    const { data: options, isLoading } = props.apiQuery({
      options: {
        enabled: inputValue !== '', // Fetch only when inputValue is not empty
        retry: false,
        refetchOnWindowFocus: false // Prevent refetching on window focus
      },
      enabled: inputValue !== '',
      queryParams: { [props.title]: inputValue, ...props.queryParams}, // Pass additional query parameters
    })

    const debouncedSetInputValue = useMemo(
      (newInputValue) =>
        debounce((newInputValue) => {
          setInputValue(newInputValue)
        }, props.debounce || 500),
      [inputValue]
    )

    const handleInputChange = (event, newInputValue) => {
      debouncedSetInputValue(newInputValue)
      // Update the value based on the input
      onValueChange(newInputValue)
    }

    const handleKeyDown = (event) => {
      if (props.onKeyDownCapture) {
        props.onKeyDownCapture(event)
      } else if (event.key === 'Tab') {
        event.preventDefault()
        props.api.tabToNextCell()
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
          options={options ? options[props.optionLabel].map(item=> ({title: item})) : []}
          includeInputInList
          value={value}
          onInputChange={handleInputChange}
          onKeyDownCapture={handleKeyDown}
          loading={isLoading}
          noOptionsText="No suggestions..."
          renderInput={(params) => <TextField {...params} fullWidth />}
          renderOption={(props, option, { inputValue }) => {
            const matches = match(option.title, inputValue, {
              insideWords: true
            })
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
      </BCBox>
    )
  }
)

AsyncSuggestionEditor.displayName = 'AsyncSuggestionEditor'
