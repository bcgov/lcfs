import BCBox from '@/components/BCBox'
import { useApiService } from '@/services/useApiService'
import { Autocomplete, Box, Grid, TextField } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import match from 'autosuggest-highlight/match'
import parse from 'autosuggest-highlight/parse'
import { debounce } from 'lodash'
import { useCallback, useState } from 'react'

/**
 * AsyncSuggestionEditor component
 *
 * @param {string} value - Current input value.
 * @param {function} onValueChange - Callback for input value changes.
 * @param {boolean} enabled - Enables/disables the component (default: true).
 * @param {number} minWords - Minimum number of words to trigger suggestions (default: 1).
 * @param {string} queryKey - Unique key for caching the async query.
 * @param {function} queryFn - Function to fetch async suggestions.
 * @param {number} debounceValue - Debounce time in ms before triggering API (default: 500ms).
 * @param {function} onKeyDownCapture - Custom handler for keydown events.
 * @param {object} api - API for grid interactions (e.g., navigation).
 * @param {string} optionLabel - Key for displaying suggestion labels (default: 'title').
 */
export const AsyncSuggestionEditor = ({
  value = '',
  onValueChange,
  enabled = true,
  minWords = 1,
  queryKey,
  queryFn,
  debounceValue = 500,
  onKeyDownCapture,
  api,
  optionLabel = 'name'
}) => {
  const [inputValue, setInputValue] = useState('')
  const [highlightedOption, setHighlightedOption] = useState(null)
  const apiService = useApiService()

  const { data: options = [], isLoading } = useQuery({
    queryKey: [queryKey || 'async-suggestion', inputValue],
    queryFn: async ({ queryKey }) => queryFn({ client: apiService, queryKey }),
    enabled: inputValue?.length >= minWords && enabled,
    retry: false,
    refetchOnWindowFocus: false
  })

  const debouncedSetInputValue = useCallback(
    debounce((newInputValue) => setInputValue(newInputValue), debounceValue),
    [debounceValue]
  )

  const handleInputChange = (_, newInputValue) => {
    debouncedSetInputValue(newInputValue)
    // Update the value based on the input
    onValueChange(newInputValue)
  }

  const handleChange = (_, newValue) => {
    if (typeof newValue === 'string') {
      debouncedSetInputValue(newValue)
      onValueChange(newValue)
    } else if (newValue && typeof newValue === 'object') {
      debouncedSetInputValue(newValue[optionLabel])
      onValueChange(newValue) // Set full object if option is an object
    } else {
      onValueChange('')
    }
  }

  const handleKeyDown = (event) => {
    if (onKeyDownCapture) {
      onKeyDownCapture(event)
    }

    if (event.key === 'Enter' && highlightedOption) {
      event.preventDefault()
      event.stopPropagation()
      handleChange(event, highlightedOption)
      api?.stopEditing?.()
      setHighlightedOption(null)
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      if (event.shiftKey) {
        // Shift + Tab: Move to the previous cell
        api.tabToPreviousCell()
      } else {
        // Tab: Move to the next cell
        api.tabToNextCell()
      }
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
          typeof option === 'string' ? option : option[optionLabel]
        }
        options={options || []}
        onHighlightChange={(_, option) => setHighlightedOption(option)}
        onClose={() => setHighlightedOption(null)}
        includeInputInList
        value={value}
        onInputChange={handleInputChange}
        filterOptions={(x) => x}
        onChange={handleChange} // Handles selection and sets correct value
        onKeyDownCapture={handleKeyDown}
        loading={isLoading}
        noOptionsText="No suggestions..."
        renderInput={(params) => <TextField {...params} fullWidth autoFocus />}
        renderOption={({ key, ...props }, option, { inputValue }) => {
          const label =
            typeof option === 'string' ? option : option[optionLabel]
          const matches = match(label, inputValue, { insideWords: true })
          const parts = parse(label, matches)

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
