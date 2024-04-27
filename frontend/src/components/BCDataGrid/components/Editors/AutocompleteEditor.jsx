import { useState, forwardRef } from 'react'
import { Autocomplete, TextField, Box, Checkbox } from '@mui/material'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import BCBox from '@/components/BCBox'
import PropTypes from 'prop-types'

const icon = <CheckBoxOutlineBlankIcon fontSize="medium" />
const checkedIcon = <CheckBoxIcon fontSize="medium" />

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
          openOnFocus={props.openOnFocus}
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
          size="medium"
          freeSolo={props.freeSolo}
          //   getOptionLabel={(option) => option}
          renderOption={(propsIn, option, { selected }) => {
            // Check if the current option is already selected
            const isOptionSelected = selectedValues && selectedValues.includes(option)
            return (
              <Box
                component="li"
                key={option}
                className={
                  (selected || isOptionSelected
                    ? 'ag-list-item ag-select-list-item selected'
                    : 'ag-list-item ag-select-list-item') +
                  ' ag-custom-component-popup'
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
                    inputProps={{ 'aria-label': 'controlled' }}
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
              size="medium"
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

AutocompleteEditor.propTypes = {
  value: PropTypes.array.isRequired,
  onValueChange: PropTypes.func.isRequired,
  eventKey: PropTypes.string.isRequired,
  rowIndex: PropTypes.number.isRequired,
  column: PropTypes.object.isRequired,
  openOnFocus: PropTypes.bool,
  multiple: PropTypes.bool,
  disableCloseOnSelect: PropTypes.bool,
  options: PropTypes.array.isRequired,
  freeSolo: PropTypes.bool
}

AutocompleteEditor.defaultProps = {
  openOnFocus: true,
  multiple: false,
  disableCloseOnSelect: false,
  freeSolo: false
}

AutocompleteEditor.displayName = 'AutocompleteEditor'
