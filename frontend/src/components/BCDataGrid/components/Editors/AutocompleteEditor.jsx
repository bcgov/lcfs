import { useState, forwardRef } from 'react'
import { Autocomplete, TextField, Box, Checkbox } from '@mui/material'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import BCBox from '@/components/BCBox'

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />
const checkedIcon = <CheckBoxIcon fontSize="small" />

export const AutocompleteEditor = forwardRef(
  ({ value, onValueChange, eventKey, rowIndex, column, ...props }, ref) => {
    const [selectedValues, setSelectedValues] = useState(value || [])
    const updateValue = (val) => {
      setSelectedValues(val)
      onValueChange(val)
    }

    return (
      <BCBox
        component="div"
        aria-label="Select options from the drop down"
        data-testid="ag-grid-editor-select-options"
        sx={{
          '& .MuiAutocomplete-inputRoot': {
            padding: 0,
            backgroundColor: '#fff',
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none'
            }
          }
        }}
      >
        <Autocomplete
          value={selectedValues}
          onChange={(_, newValue) => updateValue(newValue)}
          multiple={props.multiple}
          disableCloseOnSelect={props.disableCloseOnSelect}
          limitTags={3}
          id="bc-column-set-filter"
          className="ag-input-field ag-checkbox-input"
          role="list-box"
          options={props.options}
          autoHighlight
          size="small"
          //   getOptionLabel={(option) => option}
          renderOption={(propsIn, option, { selected }) => {
            // Check if the current option is already selected
            const isOptionSelected = value && value.includes(option)
            return (
              <Box
                component="li"
                key={option}
                className={
                  selected || isOptionSelected
                    ? 'ag-list-item ag-select-list-item selected'
                    : 'ag-list-item ag-select-list-item'
                }
                role="option"
                sx={{
                  border: 'none',
                  '& > img': { mr: 2, flexShrink: 0 }
                }}
                aria-label={`select ${option}`}
                data-testid={`select-${option}`}
                {...propsIn}
              >
                {props.multiple && (
                  <Checkbox
                    color="primary"
                    role="presentation"
                    sx={{ border: '2px solid primary' }}
                    icon={icon}
                    checkedIcon={checkedIcon}
                    style={{ marginRight: 8 }}
                    checked={selected || isOptionSelected}
                  />
                )}
                {option}
              </Box>
            )
          }}
          renderInput={(params) => (
            <TextField
              className="ag-input-field ag-checkbox-input"
              role="presentation"
              {...params}
              label="Select"
              variant="outlined"
              size="small"
              inputProps={{
                ...params.inputProps,
                autoComplete: 'new-password' // disable autocomplete and autofill
              }}
            />
          )}
        />
      </BCBox>
    )
  }
)

AutocompleteEditor.displayName = 'AutocompleteEditor'
