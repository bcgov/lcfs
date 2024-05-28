import { useState, forwardRef } from 'react'
import {
  Autocomplete,
  TextField,
  Box,
  Checkbox,
  Chip,
  Stack
} from '@mui/material'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import BCBox from '@/components/BCBox'
import PropTypes from 'prop-types'

const icon = <CheckBoxOutlineBlankIcon fontSize="medium" />
const checkedIcon = <CheckBoxIcon fontSize="medium" />

export const AutocompleteEditor = forwardRef((props, ref) => {
  const { value, onValueChange } = props
  const [selectedValues, setSelectedValues] = useState(value || [])
  const updateValue = (val) => {
    setSelectedValues(val)
    onValueChange(val)
    if (props.onDynamicUpdate) {
      props.onDynamicUpdate(val, props)
    }
  }
  const limitTags = props.limitTags || 2

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
        openOnFocus={props.openOnFocus}
        value={selectedValues}
        onChange={(_, newValue) => updateValue(newValue)}
        multiple={props.multiple}
        disableCloseOnSelect={props.disableCloseOnSelect}
        limitTags={limitTags}
        id="bc-column-set-filter"
        className="bc-column-set-filter ag-input-field ag-checkbox-input"
        role="list-box"
        options={props.options}
        autoHighlight
        size="medium"
        freeSolo={props.freeSolo}
        autoSelect={props.autoSelect}
        getOptionLabel={(option) => option}
        renderOption={(propsIn, option, { selected }) => {
          // Check if the current option is already selected
          const isOptionSelected =
            selectedValues && selectedValues.includes(option)
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
        renderInput={(params) => {
          return (
            <TextField
              className="ag-input-field ag-checkbox-input"
              role="presentation"
              {...params}
              label={
                props.colDef?.cellEditorParams.noLabel
                  ? null
                  : props.colDef?.cellEditorParams.label || 'Select'
              }
              variant="outlined"
              size="medium"
              inputProps={{
                ...params.inputProps,
                autoComplete: 'new-password' // disable autocomplete and autofill
              }}
            />
          )
        }}
        renderTags={(value, getTagProps) => {
          const numTags = value.length

          return (
            <Stack direction="row" spacing={1}>
              {value
                .slice(0, limitTags)
                .map(
                  (option, index) =>
                    index < limitTags && (
                      <Chip
                        component="span"
                        {...getTagProps({ index })}
                        key={option}
                        label={option}
                      />
                    )
                )}
              {numTags > limitTags && (
                <Chip label={` +${numTags - 2}`} size="small" />
              )}
            </Stack>
          )
        }}
      />
    </BCBox>
  )
})

AutocompleteEditor.propTypes = {
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  onValueChange: PropTypes.func.isRequired,
  eventKey: PropTypes.string,
  rowIndex: PropTypes.number,
  column: PropTypes.object,
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
