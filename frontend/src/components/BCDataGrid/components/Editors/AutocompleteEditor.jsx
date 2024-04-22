import { useState, forwardRef } from 'react'
import { Autocomplete, TextField, Box, Checkbox } from '@mui/material'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />
const checkedIcon = <CheckBoxIcon fontSize="small" />

export const AutocompleteEditor = forwardRef(
  ({ value, onValueChange, eventKey, rowIndex, column, ...props }, ref) => {
    const { columnWidth } = column.colDef
    const [selectedValues, setSelectedValues] = useState(value)
    const updateValue = (val) => {
      setSelectedValues(val)
      onValueChange(val)
    }

    return (
      <Autocomplete
        value={selectedValues}
        onChange={(_, newValue) => updateValue(newValue)}
        multiple={props.multiple}
        disableCloseOnSelect={props.disableCloseOnSelect}
        limitTags={2}
        id="bc-column-set-filter"
        className="ag-list ag-select-list ag-ltr ag-popup-child ag-popup-positioned-under"
        role="list-box"
        sx={{ width: columnWidth }}
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
              sx={{ '& > img': { mr: 2, flexShrink: 0 } }}
              {...propsIn}
            >
              {props.multiple && (
                <Checkbox
                  color="primary"
                  className="ag-set-filter-item-checkbox ag-labeled ag-label-align-right ag-checkbox ag-input-field"
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
            className="ag-text-field ag-input-field auto-select-filter"
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
    )
  }
)

AutocompleteEditor.displayName = 'AutocompleteEditor'
